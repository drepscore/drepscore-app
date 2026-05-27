/**
 * Self-heal class: stale_sync.
 *
 * Re-emits the canonical Inngest event for any sync type that has gone past
 * its `retriggerAfterMinutes` window. Throttled at SELF_HEAL_MAX_TRIGGERS
 * (3) per SELF_HEAL_WINDOW_MS (2h). A recent failure inside
 * RECENT_FAILURE_WINDOW_MS (15 min) suppresses the retrigger until the
 * caller fix lands.
 *
 * Lifted from the historical sync-freshness-guard body during Phase 2
 * slice 0; behavior preserved end-to-end.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSyncPolicy, SYNC_POLICY } from '@/lib/syncPolicy';
import { alertCritical, alertDiscord, emitPostHog, type SyncType } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import type { SelfHealClass } from '../types';

const RECENT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const SELF_HEAL_MAX_TRIGGERS = 3;
const SELF_HEAL_WINDOW_MS = 2 * 60 * 60 * 1000;

interface StaleEntry {
  syncType: string;
  staleMins: number;
  event: string;
}

export const staleSyncClass: SelfHealClass = {
  className: 'stale_sync',
  async run(ctx) {
    const recoveries: string[] = [];

    const stale = await ctx.step.run('stale_sync.check', async (): Promise<StaleEntry[]> => {
      const supabase = getSupabaseAdmin();
      const { data: rows } = await supabase.from('v_sync_health').select('*');
      if (!rows) return [];

      const now = Date.now();
      const result: StaleEntry[] = [];
      const seenTypes = new Set<string>();

      for (const row of rows) {
        seenTypes.add(row.sync_type);
        const config = getSyncPolicy(row.sync_type);
        if (!config.event) continue;
        if (!row.last_run) {
          result.push({ syncType: row.sync_type, staleMins: Infinity, event: config.event });
          continue;
        }
        const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60_000);
        if (staleMins > config.retriggerAfterMinutes) {
          result.push({ syncType: row.sync_type, staleMins, event: config.event });
        }
      }

      // "Never ran" detection: sync types in the canonical policy but
      // completely absent from v_sync_health — likely a registration or
      // trigger failure.
      for (const [syncType, config] of Object.entries(SYNC_POLICY)) {
        if (!config.event || seenTypes.has(syncType)) continue;
        result.push({ syncType, staleMins: Infinity, event: config.event });
      }

      return result;
    });

    for (const entry of stale) {
      const recovered = await ctx.step.run(`stale_sync.recover.${entry.syncType}`, async () => {
        const supabase = getSupabaseAdmin();

        const { data: recentFail } = await supabase
          .from('sync_log')
          .select('id')
          .eq('sync_type', entry.syncType)
          .eq('success', false)
          .gte('started_at', new Date(Date.now() - RECENT_FAILURE_WINDOW_MS).toISOString())
          .limit(1)
          .single();

        if (recentFail) {
          logger.info('[SelfHeal stale_sync] Skipping — recent failure within 15m', {
            syncType: entry.syncType,
          });
          await ctx.recorder.record({
            signal: { syncType: entry.syncType, staleMins: entry.staleMins },
            action: 'skip_recent_failure',
            success: false,
            detail: { reason: 'recent_failure_within_15m' },
          });
          return null;
        }

        const { count: recentTriggerCount } = await supabase
          .from('sync_log')
          .select('id', { count: 'exact', head: true })
          .eq('sync_type', entry.syncType)
          .gte('started_at', new Date(Date.now() - SELF_HEAL_WINDOW_MS).toISOString());

        if ((recentTriggerCount ?? 0) >= SELF_HEAL_MAX_TRIGGERS) {
          logger.info('[SelfHeal stale_sync] Throttling — too many recent runs', {
            syncType: entry.syncType,
            recentTriggerCount,
            max: SELF_HEAL_MAX_TRIGGERS,
          });
          await alertCritical(
            `Self-Heal Throttled: ${entry.syncType}`,
            `${recentTriggerCount} runs in last 2h but still stale (${entry.staleMins}m). Possible persistent failure — needs manual investigation.`,
          );
          await ctx.recorder.record({
            signal: {
              syncType: entry.syncType,
              staleMins: entry.staleMins,
              recentTriggerCount,
            },
            action: 'throttle_escalate',
            success: false,
            escalated: true,
            detail: { reason: 'too_many_recent_runs', max: SELF_HEAL_MAX_TRIGGERS },
          });
          return null;
        }

        logger.info('[SelfHeal stale_sync] Retriggering stale sync via Inngest event', {
          syncType: entry.syncType,
          staleMins: entry.staleMins,
        });
        await inngest.send({ name: entry.event });

        emitPostHog(true, entry.syncType as SyncType, 0, {
          event_override: 'sync_self_healed',
          staleness_minutes: entry.staleMins,
        });
        await alertDiscord(
          `Self-Healed: ${entry.syncType}`,
          `Sync was ${entry.staleMins}m stale. Retriggered via freshness guard (Inngest event).`,
        );

        await ctx.recorder.record({
          signal: { syncType: entry.syncType, staleMins: entry.staleMins, event: entry.event },
          action: 'retrigger_event',
          success: true,
          detail: { recentTriggerCount: recentTriggerCount ?? 0 },
        });

        return { syncType: entry.syncType, staleMins: entry.staleMins };
      });

      if (recovered) {
        recoveries.push(`${recovered.syncType}: ${recovered.staleMins}m stale`);
      }
    }

    return {
      className: 'stale_sync',
      actions: recoveries.length,
      details: recoveries,
    };
  },
};
