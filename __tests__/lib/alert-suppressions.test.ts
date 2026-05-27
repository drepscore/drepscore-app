import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => supabaseMocks.getSupabaseAdminMock(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  ALERT_SUPPRESSIONS,
  effectiveStatusAfterSuppression,
  isSuppressed,
  loadQuarantinedMetrics,
  partitionMismatches,
} from '@/lib/reconciliation/alert-suppressions';
import type { CheckResult } from '@/lib/reconciliation/types';

const baseCheck: Omit<CheckResult, 'metric' | 'status'> = {
  tier: 1,
  ours: 1,
  theirs: 2,
};

function mismatch(metric: string, status: CheckResult['status'] = 'mismatch'): CheckResult {
  return { ...baseCheck, metric, status };
}

describe('alert-suppressions', () => {
  describe('ALERT_SUPPRESSIONS catalog', () => {
    it('every entry cites a reason and a suppressedSince date', () => {
      for (const entry of ALERT_SUPPRESSIONS) {
        expect(entry.metric).toBeTruthy();
        expect(entry.reason.length).toBeGreaterThan(50);
        expect(entry.suppressedSince).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    });

    it('expiresAt entries are valid dates when set', () => {
      for (const entry of ALERT_SUPPRESSIONS) {
        if (entry.expiresAt) {
          expect(new Date(entry.expiresAt).toString()).not.toBe('Invalid Date');
        }
      }
    });

    it('includes the documented Total registered DReps suppression', () => {
      const drepSuppression = ALERT_SUPPRESSIONS.find((s) => s.metric === 'Total registered DReps');
      expect(drepSuppression).toBeDefined();
      expect(drepSuppression?.reason).toContain('Koios');
      expect(drepSuppression?.reason).toContain('Blockfrost');
    });
  });

  describe('isSuppressed', () => {
    it('returns true for a suppressed metric inside its window', () => {
      expect(isSuppressed('Total registered DReps')).toBe(true);
    });

    it('returns false for an unrelated metric', () => {
      expect(isSuppressed('Total proposals')).toBe(false);
      expect(isSuppressed('Treasury balance (lovelace)')).toBe(false);
    });

    it('returns false for a suppressed metric after its expiry', () => {
      const farFuture = new Date('2099-01-01T00:00:00Z');
      expect(isSuppressed('Total registered DReps', farFuture)).toBe(false);
    });

    it('returns false for an unknown metric', () => {
      expect(isSuppressed('Some Brand New Metric')).toBe(false);
    });

    it('returns true for a dynamically quarantined metric', () => {
      expect(isSuppressed('Foo', undefined, new Set(['Foo']))).toBe(true);
    });
  });

  describe('partitionMismatches', () => {
    it('routes suppressed metrics to suppressed and others to surfaced', () => {
      const mismatches = [
        mismatch('Total registered DReps'),
        mismatch('Total proposals'),
        mismatch('Treasury balance (lovelace)', 'drift'),
      ];
      const { surfaced, suppressed } = partitionMismatches(mismatches);
      expect(surfaced.map((m) => m.metric)).toEqual([
        'Total proposals',
        'Treasury balance (lovelace)',
      ]);
      expect(suppressed.map((m) => m.metric)).toEqual(['Total registered DReps']);
    });

    it('returns empty arrays when no mismatches given', () => {
      const { surfaced, suppressed } = partitionMismatches([]);
      expect(surfaced).toEqual([]);
      expect(suppressed).toEqual([]);
    });

    it('returns all in surfaced when none are suppressed', () => {
      const mismatches = [mismatch('Total proposals'), mismatch('Current epoch', 'drift')];
      const { surfaced, suppressed } = partitionMismatches(mismatches);
      expect(surfaced).toHaveLength(2);
      expect(suppressed).toHaveLength(0);
    });

    it('returns all in suppressed when only suppressed metrics present', () => {
      const mismatches = [mismatch('Total registered DReps')];
      const { surfaced, suppressed } = partitionMismatches(mismatches);
      expect(surfaced).toHaveLength(0);
      expect(suppressed).toHaveLength(1);
    });

    it('suppresses dynamically quarantined metrics outside the static catalog', () => {
      const mismatches = [mismatch('Foo'), mismatch('Total proposals')];
      const { surfaced, suppressed } = partitionMismatches(mismatches, undefined, new Set(['Foo']));
      expect(surfaced.map((m) => m.metric)).toEqual(['Total proposals']);
      expect(suppressed.map((m) => m.metric)).toEqual(['Foo']);
    });

    it('keeps static-only behavior when no dynamic quarantines are passed', () => {
      const mismatches = [mismatch('Foo'), mismatch('Total registered DReps')];
      const { surfaced, suppressed } = partitionMismatches(mismatches);
      expect(surfaced.map((m) => m.metric)).toEqual(['Foo']);
      expect(suppressed.map((m) => m.metric)).toEqual(['Total registered DReps']);
    });
  });

  describe('effectiveStatusAfterSuppression', () => {
    it('returns match when no surfaced mismatches', () => {
      expect(effectiveStatusAfterSuppression([])).toBe('match');
    });

    it('returns mismatch when any surfaced has mismatch status', () => {
      expect(effectiveStatusAfterSuppression([{ status: 'drift' }, { status: 'mismatch' }])).toBe(
        'mismatch',
      );
    });

    it('returns drift when surfaced contains only drift', () => {
      expect(effectiveStatusAfterSuppression([{ status: 'drift' }, { status: 'drift' }])).toBe(
        'drift',
      );
    });

    it('escalates to mismatch even if drift comes first', () => {
      expect(effectiveStatusAfterSuppression([{ status: 'drift' }, { status: 'mismatch' }])).toBe(
        'mismatch',
      );
    });
  });

  describe('loadQuarantinedMetrics', () => {
    interface QuarantineRow {
      metric: string;
      expires_at: string | null;
    }

    function makeSupabase(rows: QuarantineRow[]) {
      const captured = { orFilter: '' as string };
      const client = {
        from(table: string) {
          if (table !== 'quarantined_metrics') {
            throw new Error(`Unexpected table: ${table}`);
          }
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn((filter: string) => {
                captured.orFilter = filter;
                // The real Supabase client applies the .or() filter
                // server-side. We honor it here so the test exercises the
                // intent of the query, not just the call shape.
                const now = Date.now();
                const filtered = rows.filter((r) => {
                  if (r.expires_at === null) return true;
                  return new Date(r.expires_at).getTime() > now;
                });
                return Promise.resolve({
                  data: filtered.map((r) => ({ metric: r.metric })),
                  error: null,
                });
              }),
            }),
          };
        },
      };
      return { captured, client };
    }

    beforeEach(() => {
      supabaseMocks.getSupabaseAdminMock.mockReset();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns only metrics whose expires_at is null or in the future', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-27T12:00:00Z'));

      const { client, captured } = makeSupabase([
        { metric: 'active-with-expiry', expires_at: '2026-06-03T12:00:00.000Z' },
        { metric: 'active-no-expiry', expires_at: null },
        { metric: 'expired-yesterday', expires_at: '2026-05-26T12:00:00.000Z' },
        { metric: 'expired-just-now', expires_at: '2026-05-27T11:59:59.000Z' },
      ]);
      supabaseMocks.getSupabaseAdminMock.mockReturnValue(client);

      const result = await loadQuarantinedMetrics();
      expect(Array.from(result).sort()).toEqual(['active-no-expiry', 'active-with-expiry']);
      // Sanity-check the actual filter string the production code sends to
      // Supabase — guarding the postgrest expression catches future regressions.
      expect(captured.orFilter).toContain('expires_at.is.null');
      expect(captured.orFilter).toContain('expires_at.gt.2026-05-27T12:00:00.000Z');
    });

    it('returns an empty set when the supabase call errors', async () => {
      const client = {
        from() {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn(async () => ({ data: null, error: { message: 'boom' } })),
            }),
          };
        },
      };
      supabaseMocks.getSupabaseAdminMock.mockReturnValue(client);
      const result = await loadQuarantinedMetrics();
      expect(result.size).toBe(0);
    });

    it('returns an empty set when getSupabaseAdmin throws', async () => {
      supabaseMocks.getSupabaseAdminMock.mockImplementation(() => {
        throw new Error('admin client init failed');
      });
      const result = await loadQuarantinedMetrics();
      expect(result.size).toBe(0);
    });
  });

  describe('integration: full alert-decision flow', () => {
    it('persistent DRep mismatch + clean others → effective match (no alert)', () => {
      const reportMismatches = [mismatch('Total registered DReps')];
      const { surfaced, suppressed } = partitionMismatches(reportMismatches);
      expect(effectiveStatusAfterSuppression(surfaced)).toBe('match');
      expect(suppressed).toHaveLength(1);
    });

    it('persistent DRep mismatch + novel mismatch → still alerts on the novel one', () => {
      const reportMismatches = [mismatch('Total registered DReps'), mismatch('Total proposals')];
      const { surfaced, suppressed } = partitionMismatches(reportMismatches);
      expect(effectiveStatusAfterSuppression(surfaced)).toBe('mismatch');
      expect(surfaced.map((m) => m.metric)).toEqual(['Total proposals']);
      expect(suppressed).toHaveLength(1);
    });
  });
});
