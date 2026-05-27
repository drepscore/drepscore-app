/**
 * Self-heal class: persistent_mismatch.
 *
 * Watches recent reconciliation runs for metrics that mismatch on their three
 * most-recent appearances and whose mismatch streak spans at least
 * QUARANTINE_MIN_WINDOW_MS. The time-window gate stops a single ~15-min
 * tier1 noise burst from earning a 7-day quarantine. A new or expired
 * quarantine records an escalated audit row and sends one Discord notice;
 * active quarantines only refresh last_seen_at so the walker can run every
 * tick without alert duplication.
 *
 * DB side effects are split into separate step.run boundaries so Inngest's
 * per-step memoization handles partial failures. The DB write goes first so
 * the active row gates the Discord notice: if Discord delivery is unavailable,
 * the next tick sees the existing quarantine and takes the refresh path
 * instead of re-alerting. Every Supabase call checks `error` and throws on
 * failure; we never proceed to a downstream step on uncertain DB state.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { alertDiscord } from '@/lib/sync-utils';
import type { CheckResult, CheckStatus } from '@/lib/reconciliation/types';
import type { SelfHealClass } from '../types';

const QUARANTINE_REASON = '3+ consecutive mismatches spanning at least 30 minutes';
const QUARANTINE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const QUARANTINE_MIN_WINDOW_MS = 30 * 60 * 1000;
const MIN_CONSECUTIVE_COUNT = 3;
const SCAN_WINDOW_ROWS = 50;

interface ReconciliationLogRow {
  id: string;
  checked_at: string;
  results: unknown;
  tier_scope: string | null;
}

interface QuarantineCandidate {
  metric: string;
  consecutiveCount: number;
  spanMs: number;
  recentStatuses: CheckStatus[];
}

interface QuarantinedMetricRow {
  metric: string;
  expires_at: string | null;
  consecutive_count: number | null;
}

interface MetricAppearance {
  status: CheckStatus;
  checkedAt: string;
}

type QuarantineAction = 'refresh' | 'create' | 'renew';

interface QuarantineDecision {
  action: QuarantineAction;
  nowIso: string;
  expiresAt: string;
}

function isCheckStatus(value: unknown): value is CheckStatus {
  return value === 'match' || value === 'drift' || value === 'mismatch';
}

function isCheckResult(value: unknown): value is Pick<CheckResult, 'metric' | 'status'> {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as { metric?: unknown; status?: unknown };
  return typeof maybe.metric === 'string' && isCheckStatus(maybe.status);
}

function leadingMismatchCount(appearances: MetricAppearance[]): number {
  let count = 0;
  for (const entry of appearances) {
    if (entry.status !== 'mismatch') break;
    count += 1;
  }
  return count;
}

function findCandidates(rows: ReconciliationLogRow[]): QuarantineCandidate[] {
  const history = new Map<string, MetricAppearance[]>();

  for (const row of rows) {
    if (!Array.isArray(row.results)) continue;

    for (const result of row.results) {
      if (!isCheckResult(result)) continue;
      const appearances = history.get(result.metric) ?? [];
      appearances.push({ status: result.status, checkedAt: row.checked_at });
      history.set(result.metric, appearances);
    }
  }

  const candidates: QuarantineCandidate[] = [];
  for (const [metric, appearances] of history.entries()) {
    const consecutiveCount = leadingMismatchCount(appearances);
    if (consecutiveCount < MIN_CONSECUTIVE_COUNT) continue;

    const leading = appearances.slice(0, consecutiveCount);
    const newest = new Date(leading[0].checkedAt).getTime();
    const oldest = new Date(leading[leading.length - 1].checkedAt).getTime();
    const spanMs = newest - oldest;
    if (spanMs < QUARANTINE_MIN_WINDOW_MS) continue;

    candidates.push({
      metric,
      consecutiveCount,
      spanMs,
      recentStatuses: leading.map((entry) => entry.status),
    });
  }

  return candidates;
}

function isActiveQuarantine(row: QuarantinedMetricRow, now: Date): boolean {
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > now.getTime();
}

export const persistentMismatchClass: SelfHealClass = {
  className: 'persistent_mismatch',
  async run(ctx) {
    const quarantines: string[] = [];

    const candidates = await ctx.step.run(
      'persistent_mismatch.scan',
      async (): Promise<QuarantineCandidate[]> => {
        const supabase = getSupabaseAdmin();
        const { data: rows, error } = await supabase
          .from('reconciliation_log')
          .select('id, checked_at, results, tier_scope')
          .order('checked_at', { ascending: false })
          .limit(SCAN_WINDOW_ROWS);

        if (error) {
          logger.warn('[SelfHeal persistent_mismatch] Failed to scan reconciliation_log', {
            error: error.message,
          });
          return [];
        }

        return findCandidates((rows ?? []) as ReconciliationLogRow[]);
      },
    );

    for (const candidate of candidates) {
      // Step 1: read existing quarantine and decide path. The decision step
      // captures `nowIso` and `expiresAt` so subsequent steps see the same
      // anchor time across Inngest retries. A read error throws so Inngest
      // retries the read in isolation; we never proceed to Discord/audit
      // on uncertain DB state.
      const decision = await ctx.step.run(
        `persistent_mismatch.decide.${candidate.metric}`,
        async (): Promise<QuarantineDecision> => {
          const supabase = getSupabaseAdmin();
          const now = new Date();
          const nowIso = now.toISOString();
          const expiresAt = new Date(now.getTime() + QUARANTINE_TTL_MS).toISOString();

          const { data: existing, error: readError } = await supabase
            .from('quarantined_metrics')
            .select('metric, expires_at, consecutive_count')
            .eq('metric', candidate.metric)
            .maybeSingle();

          if (readError) {
            throw new Error(
              `[SelfHeal persistent_mismatch] Failed to read quarantine state for ${candidate.metric}: ${readError.message}`,
            );
          }

          const existingRow = existing as QuarantinedMetricRow | null;
          if (existingRow && isActiveQuarantine(existingRow, now)) {
            return { action: 'refresh', nowIso, expiresAt };
          }
          if (existingRow) {
            return { action: 'renew', nowIso, expiresAt };
          }
          return { action: 'create', nowIso, expiresAt };
        },
      );

      if (decision.action === 'refresh') {
        // Idempotent ping: bump last_seen_at + record the current streak.
        // No audit row, no Discord; the original quarantine already
        // landed both. Update errors throw to retry, but never spam alerts.
        await ctx.step.run(`persistent_mismatch.refresh.${candidate.metric}`, async () => {
          const supabase = getSupabaseAdmin();
          const { error: refreshError } = await supabase
            .from('quarantined_metrics')
            .update({
              last_seen_at: decision.nowIso,
              consecutive_count: candidate.consecutiveCount,
            })
            .eq('metric', candidate.metric);

          if (refreshError) {
            throw new Error(
              `[SelfHeal persistent_mismatch] Failed to refresh quarantine for ${candidate.metric}: ${refreshError.message}`,
            );
          }
          return null;
        });
        continue;
      }

      // create / renew: DB write FIRST (so the row's existence guards the
      // Discord notice. If Discord later fails permanently, the next tick
      // sees the active row and takes the refresh path, no spam), then
      // alert, then audit. Each step throws on its own failure so Inngest
      // retries it in isolation.
      await ctx.step.run(`persistent_mismatch.write.${candidate.metric}`, async () => {
        const supabase = getSupabaseAdmin();
        const payload = {
          metric: candidate.metric,
          quarantined_at: decision.nowIso,
          expires_at: decision.expiresAt,
          reason: QUARANTINE_REASON,
          consecutive_count: candidate.consecutiveCount,
          last_seen_at: decision.nowIso,
          surfaced_to_users: true,
          source: 'persistent_mismatch',
        };

        const { error: writeError } =
          decision.action === 'renew'
            ? await supabase.from('quarantined_metrics').upsert(payload, { onConflict: 'metric' })
            : await supabase.from('quarantined_metrics').insert(payload);

        if (writeError) {
          throw new Error(
            `[SelfHeal persistent_mismatch] Failed to ${decision.action} quarantine for ${candidate.metric}: ${writeError.message}`,
          );
        }
        return null;
      });

      await ctx.step.run(`persistent_mismatch.alert.${candidate.metric}`, async () => {
        await alertDiscord(
          `Metric quarantined: ${candidate.metric}`,
          `${QUARANTINE_REASON}. The metric is suppressed from reconciliation alerts until ${decision.expiresAt}.`,
        );
        return null;
      });

      await ctx.step.run(`persistent_mismatch.audit.${candidate.metric}`, async () => {
        await ctx.recorder.record({
          signal: {
            metric: candidate.metric,
            consecutive_count: candidate.consecutiveCount,
            span_ms: candidate.spanMs,
            recent_statuses: candidate.recentStatuses,
          },
          action: 'quarantine_metric',
          success: true,
          escalated: true,
          detail: { reason: QUARANTINE_REASON, expiresAt: decision.expiresAt },
        });
        return null;
      });

      quarantines.push(candidate.metric);
    }

    return {
      className: 'persistent_mismatch',
      actions: quarantines.length,
      details: quarantines,
    };
  },
};
