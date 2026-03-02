/**
 * Sync Freshness Guard — rapid self-healing cron.
 * Runs every 30 min, checks v_sync_health for stale syncs, and retriggers them.
 * Much faster recovery than the 6h integrity alert.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { callSyncRoute } from '@/inngest/helpers';
import { alertDiscord, errMsg, emitPostHog, type SyncType } from '@/lib/sync-utils';

const FRESHNESS_THRESHOLDS: Record<string, { mins: number; route: string }> = {
  proposals: { mins: 90, route: '/api/sync/proposals' },
  dreps:     { mins: 480, route: '/api/sync/dreps' },
  votes:     { mins: 480, route: '/api/sync/votes' },
  secondary: { mins: 480, route: '/api/sync/secondary' },
  slow:      { mins: 1800, route: '/api/sync/slow' },
};

const RECENT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const GHOST_THRESHOLD_MS = 30 * 60 * 1000;

export const syncFreshnessGuard = inngest.createFunction(
  {
    id: 'sync-freshness-guard',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"freshness-guard"' },
  },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const recoveries: string[] = [];

    await step.run('cleanup-ghost-entries', async () => {
      const supabase = getSupabaseAdmin();
      const cutoff = new Date(Date.now() - GHOST_THRESHOLD_MS).toISOString();
      const { data: ghosts } = await supabase
        .from('sync_log')
        .select('id, sync_type, started_at')
        .eq('success', false)
        .is('error_message', null)
        .is('duration_ms', null)
        .lt('started_at', cutoff);

      if (!ghosts || ghosts.length === 0) return 0;

      for (const ghost of ghosts) {
        await supabase.from('sync_log')
          .update({
            error_message: 'Process terminated (likely deployment restart)',
            duration_ms: 0,
          })
          .eq('id', ghost.id);
      }
      console.log(`[FreshnessGuard] Cleaned up ${ghosts.length} ghost sync_log entries`);
      return ghosts.length;
    });

    const staleTypes = await step.run('check-freshness', async () => {
      const supabase = getSupabaseAdmin();
      const { data: rows } = await supabase.from('v_sync_health').select('*');
      if (!rows) return [];

      const now = Date.now();
      const stale: { syncType: string; staleMins: number; route: string }[] = [];

      for (const row of rows) {
        const config = FRESHNESS_THRESHOLDS[row.sync_type];
        if (!config) continue;
        if (!row.last_run) {
          stale.push({ syncType: row.sync_type, staleMins: Infinity, route: config.route });
          continue;
        }

        const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60_000);
        if (staleMins > config.mins) {
          stale.push({ syncType: row.sync_type, staleMins, route: config.route });
        }
      }

      return stale;
    });

    if (staleTypes.length === 0) {
      return { recovered: 0, message: 'All syncs fresh' };
    }

    for (const { syncType, staleMins, route } of staleTypes) {
      const recovered = await step.run(`recover-${syncType}`, async () => {
        const supabase = getSupabaseAdmin();

        const { data: recentFail } = await supabase
          .from('sync_log')
          .select('id')
          .eq('sync_type', syncType)
          .eq('success', false)
          .gte('started_at', new Date(Date.now() - RECENT_FAILURE_WINDOW_MS).toISOString())
          .limit(1)
          .single();

        if (recentFail) {
          console.log(`[FreshnessGuard] Skipping ${syncType} — recent failure within 15m, letting Inngest retry handle it`);
          return null;
        }

        console.log(`[FreshnessGuard] Retriggering ${syncType} (${staleMins}m stale)`);
        try {
          const { status } = await callSyncRoute(route, 300_000);
          emitPostHog(true, syncType as SyncType, 0, {
            event_override: 'sync_self_healed',
            staleness_minutes: staleMins,
            retrigger_status: status,
          });
          await alertDiscord(
            `Self-Healed: ${syncType}`,
            `Sync was ${staleMins}m stale. Retriggered via freshness guard → ${status}.`,
          );
          return { syncType, status, staleMins };
        } catch (e) {
          console.error(`[FreshnessGuard] Failed to retrigger ${syncType}:`, errMsg(e));
          await alertDiscord(
            `Self-Heal Failed: ${syncType}`,
            `Sync was ${staleMins}m stale. Retrigger failed: ${errMsg(e)}`,
          );
          return null;
        }
      });

      if (recovered) {
        recoveries.push(`${recovered.syncType}: ${recovered.status}`);
      }
    }

    return { recovered: recoveries.length, details: recoveries };
  },
);
