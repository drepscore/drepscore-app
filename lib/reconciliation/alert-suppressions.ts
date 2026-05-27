/**
 * Reconciliation alert suppressions.
 *
 * Two-layer suppression model:
 *   1. The static `ALERT_SUPPRESSIONS` allowlist below: hand-managed
 *      entries for known persistent conditions. Each entry cites a reason
 *      and an investigation pointer so the suppression has a retirement
 *      path; it's a deliberate noise downgrade while a real fix lands.
 *   2. The dynamic `quarantined_metrics` table: populated by the
 *      `persistent_mismatch` self-heal class (Phase 2 slice 1) when a
 *      metric mismatches 3+ consecutive times spanning at least 30 min.
 *      `loadQuarantinedMetrics()` returns the current active set and the
 *      callers thread it into `partitionMismatches` / `isSuppressed`.
 *
 * The reconciliation_log audit trail always records every mismatch in
 * full; suppression only affects Discord alerting and the GHI
 * `crossReferenceAlert` surface.
 */
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { CheckResult } from './types';

export interface AlertSuppression {
  /** Exact metric name from CheckResult.metric */
  metric: string;
  /** Why this is suppressed (cite evidence + investigation pointer) */
  reason: string;
  /** ISO date when suppression started */
  suppressedSince: string;
  /** Optional ISO date when suppression auto-expires (defense against stale entries) */
  expiresAt?: string;
}

export const ALERT_SUPPRESSIONS: AlertSuppression[] = [
  {
    metric: 'Total registered DReps',
    reason:
      'Persistent ~27% delta between Koios (ours) and Blockfrost (theirs) — diff ~435 absolute. ' +
      'lib/reconciliation/types.ts:138-140 documents that this gap is expected because Koios only ' +
      'returns active DReps while Blockfrost includes retired; the percentRelative tolerance was ' +
      'set to 35% accordingly. countAbsolute (50) is the strict gate that keeps tripping on every ' +
      "run. Surfaced loudly when sample-tier1's 5-min cadence shipped 2026-05-10. Investigation " +
      'pending: either tune countAbsolute to ~500 (matches the documented intent), or fix the ' +
      'underlying counting semantic so the two sources agree. Suppress until either resolves.',
    suppressedSince: '2026-05-10',
    expiresAt: '2026-08-10',
  },
];

export interface SuppressionResult<T extends Pick<CheckResult, 'metric'>> {
  /** Mismatches that should still surface to alerting */
  surfaced: T[];
  /** Mismatches that matched a suppression entry */
  suppressed: T[];
}

const SUPPRESSED_METRICS_LOOKUP = new Map<string, AlertSuppression>(
  ALERT_SUPPRESSIONS.map((entry) => [entry.metric, entry]),
);

export async function loadQuarantinedMetrics(now: Date = new Date()): Promise<Set<string>> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('quarantined_metrics')
      .select('metric')
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);

    if (error) {
      logger.warn('[Reconciliation] Failed to load quarantined metrics', {
        error: error.message,
      });
      return new Set();
    }

    return new Set(
      (data ?? [])
        .map((row: { metric?: unknown }) => row.metric)
        .filter((metric): metric is string => typeof metric === 'string' && metric.length > 0),
    );
  } catch (error) {
    logger.warn('[Reconciliation] Failed to load quarantined metrics', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set();
  }
}

export function isSuppressed(
  metric: string,
  now: Date = new Date(),
  dynamicQuarantines?: Set<string>,
): boolean {
  if (dynamicQuarantines?.has(metric)) return true;
  const entry = SUPPRESSED_METRICS_LOOKUP.get(metric);
  if (!entry) return false;
  if (entry.expiresAt && new Date(entry.expiresAt) < now) return false;
  return true;
}

export function partitionMismatches<T extends Pick<CheckResult, 'metric'>>(
  mismatches: T[],
  now: Date = new Date(),
  dynamicQuarantines?: Set<string>,
): SuppressionResult<T> {
  const surfaced: T[] = [];
  const suppressed: T[] = [];
  for (const mismatch of mismatches) {
    if (isSuppressed(mismatch.metric, now, dynamicQuarantines)) suppressed.push(mismatch);
    else surfaced.push(mismatch);
  }
  return { surfaced, suppressed };
}

/**
 * Effective overall status after suppression: if all mismatches are
 * suppressed, treat as 'match' for alerting purposes (the reconciliation_log
 * still records the true status). If any unsuppressed remain, return the
 * worst of those.
 */
export function effectiveStatusAfterSuppression(
  surfaced: Array<Pick<CheckResult, 'status'>>,
): 'match' | 'drift' | 'mismatch' {
  if (surfaced.length === 0) return 'match';
  if (surfaced.some((m) => m.status === 'mismatch')) return 'mismatch';
  return 'drift';
}
