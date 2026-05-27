import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alertDiscordMock: vi.fn(async () => undefined),
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock('@/lib/sync-utils', () => ({
  alertDiscord: mocks.alertDiscordMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdminMock(),
}));

const { alertDiscordMock, getSupabaseAdminMock } = mocks;

import { persistentMismatchClass } from '@/lib/selfHeal/classes/persistentMismatch';
import type { SelfHealRecordInput, SelfHealStep } from '@/lib/selfHeal/types';
import type { CheckResult } from '@/lib/reconciliation/types';

const passthroughStep: SelfHealStep = {
  async run(_id, fn) {
    return fn();
  },
};

interface ReconciliationRow {
  id: string;
  checked_at: string;
  tier_scope: string;
  results: CheckResult[];
}

interface QuarantinedMetric {
  metric: string;
  expires_at: string | null;
  consecutive_count: number;
}

function result(metric: string, status: CheckResult['status']): CheckResult {
  return {
    metric,
    status,
    tier: 1,
    ours: 1,
    theirs: 2,
  };
}

// Default spacing of 15 minutes: 3 rows span exactly 30 minutes, which is
// the time-window gate boundary used by persistentMismatchClass.
const DEFAULT_ROW_SPACING_MS = 15 * 60 * 1000;

function reconciliationRows(
  statusesByRow: CheckResult[][],
  spacingMs: number = DEFAULT_ROW_SPACING_MS,
): ReconciliationRow[] {
  return statusesByRow.map((results, index) => ({
    id: `row-${index}`,
    checked_at: new Date(Date.now() - index * spacingMs).toISOString(),
    tier_scope: 'tier1_sample',
    results,
  }));
}

interface ErrorInjection {
  readError?: { message: string };
  insertError?: { message: string };
  upsertError?: { message: string };
  updateError?: { message: string };
}

function makeSupabase({
  rows,
  quarantined = new Map<string, QuarantinedMetric>(),
  errors = {},
}: {
  rows: ReconciliationRow[];
  quarantined?: Map<string, QuarantinedMetric>;
  errors?: ErrorInjection;
}) {
  const writes = {
    inserts: [] as Array<Record<string, unknown>>,
    upserts: [] as Array<Record<string, unknown>>,
    updates: [] as Array<{ metric: string; payload: Record<string, unknown> }>,
  };

  return {
    writes,
    client: {
      from(table: string) {
        if (table === 'reconciliation_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn(async () => ({ data: rows, error: null })),
              }),
            }),
          };
        }

        if (table === 'quarantined_metrics') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn((_column: string, metric: string) => ({
                maybeSingle: vi.fn(async () => ({
                  data: errors.readError ? null : (quarantined.get(metric) ?? null),
                  error: errors.readError ?? null,
                })),
              })),
            }),
            insert: vi.fn(async (payload: Record<string, unknown>) => {
              if (errors.insertError) return { error: errors.insertError };
              writes.inserts.push(payload);
              return { error: null };
            }),
            upsert: vi.fn(async (payload: Record<string, unknown>) => {
              if (errors.upsertError) return { error: errors.upsertError };
              writes.upserts.push(payload);
              return { error: null };
            }),
            update: vi.fn((payload: Record<string, unknown>) => ({
              eq: vi.fn(async (_column: string, metric: string) => {
                if (errors.updateError) return { error: errors.updateError };
                writes.updates.push({ metric, payload });
                return { error: null };
              }),
            })),
          };
        }

        throw new Error(`Unexpected table in test: ${table}`);
      },
    },
  };
}

function makeRecorder() {
  const records: SelfHealRecordInput[] = [];
  return {
    records,
    recorder: {
      async record(input: SelfHealRecordInput) {
        records.push(input);
      },
    },
  };
}

describe('persistentMismatchClass', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T12:00:00Z'));
    alertDiscordMock.mockClear();
    getSupabaseAdminMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('quarantines and escalates when a metric has three consecutive mismatches', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
      ]),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    const output = await persistentMismatchClass.run({ step: passthroughStep, recorder });

    expect(output.actions).toBe(1);
    expect(output.details).toEqual(['Test metric']);
    expect(supabase.writes.inserts).toHaveLength(1);
    expect(supabase.writes.inserts[0]).toMatchObject({
      metric: 'Test metric',
      reason: '3+ consecutive mismatches spanning at least 30 minutes',
      consecutive_count: 3,
      source: 'persistent_mismatch',
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      action: 'quarantine_metric',
      success: true,
      escalated: true,
      signal: {
        metric: 'Test metric',
        consecutive_count: 3,
        recent_statuses: ['mismatch', 'mismatch', 'mismatch'],
      },
    });
    expect(alertDiscordMock).toHaveBeenCalledTimes(1);
    expect(alertDiscordMock).toHaveBeenCalledWith(
      'Metric quarantined: Test metric',
      expect.stringContaining('consecutive mismatches spanning at least 30 minutes'),
    );
  });

  it('refreshes an active quarantine without writing a new audit row or Discord notice', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
      ]),
      quarantined: new Map([
        [
          'Test metric',
          {
            metric: 'Test metric',
            expires_at: '2026-05-30T12:00:00.000Z',
            consecutive_count: 4,
          },
        ],
      ]),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    const output = await persistentMismatchClass.run({ step: passthroughStep, recorder });

    expect(output.actions).toBe(0);
    expect(supabase.writes.inserts).toHaveLength(0);
    expect(supabase.writes.upserts).toHaveLength(0);
    expect(supabase.writes.updates).toEqual([
      {
        metric: 'Test metric',
        payload: {
          last_seen_at: '2026-05-27T12:00:00.000Z',
          consecutive_count: 3,
        },
      },
    ]);
    expect(records).toHaveLength(0);
    expect(alertDiscordMock).not.toHaveBeenCalled();
  });

  it('renews an expired quarantine as a new escalated quarantine', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
      ]),
      quarantined: new Map([
        [
          'Test metric',
          {
            metric: 'Test metric',
            expires_at: '2026-05-26T12:00:00.000Z',
            consecutive_count: 3,
          },
        ],
      ]),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    const output = await persistentMismatchClass.run({ step: passthroughStep, recorder });

    expect(output.actions).toBe(1);
    expect(supabase.writes.inserts).toHaveLength(0);
    expect(supabase.writes.upserts).toHaveLength(1);
    expect(supabase.writes.upserts[0]).toMatchObject({
      metric: 'Test metric',
      quarantined_at: '2026-05-27T12:00:00.000Z',
      expires_at: '2026-06-03T12:00:00.000Z',
      consecutive_count: 3,
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.action).toBe('quarantine_metric');
    expect(records[0]?.escalated).toBe(true);
    expect(alertDiscordMock).toHaveBeenCalledTimes(1);
  });

  it('does not quarantine when the most recent three appearances are not all mismatches', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'match')],
      ]),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    const output = await persistentMismatchClass.run({ step: passthroughStep, recorder });

    expect(output.actions).toBe(0);
    expect(supabase.writes.inserts).toHaveLength(0);
    expect(supabase.writes.upserts).toHaveLength(0);
    expect(supabase.writes.updates).toHaveLength(0);
    expect(records).toHaveLength(0);
    expect(alertDiscordMock).not.toHaveBeenCalled();
  });

  it('does not quarantine when three consecutive mismatches span less than 30 minutes', async () => {
    // tier1 cadence (5 min between rows) produces a 10-min span across 3
    // rows, under the 30-min gate, even with three consecutive mismatches.
    const supabase = makeSupabase({
      rows: reconciliationRows(
        [
          [result('Test metric', 'mismatch')],
          [result('Test metric', 'mismatch')],
          [result('Test metric', 'mismatch')],
        ],
        5 * 60 * 1000,
      ),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    const output = await persistentMismatchClass.run({ step: passthroughStep, recorder });

    expect(output.actions).toBe(0);
    expect(supabase.writes.inserts).toHaveLength(0);
    expect(supabase.writes.upserts).toHaveLength(0);
    expect(supabase.writes.updates).toHaveLength(0);
    expect(records).toHaveLength(0);
    expect(alertDiscordMock).not.toHaveBeenCalled();
  });

  it('quarantines a longer streak that clears the 30-minute window over more rows', async () => {
    // 7 consecutive mismatches at 5-min spacing spans exactly 30 minutes.
    const supabase = makeSupabase({
      rows: reconciliationRows(
        Array.from({ length: 7 }, () => [result('Test metric', 'mismatch')]),
        5 * 60 * 1000,
      ),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    const output = await persistentMismatchClass.run({ step: passthroughStep, recorder });

    expect(output.actions).toBe(1);
    expect(supabase.writes.inserts).toHaveLength(1);
    expect(supabase.writes.inserts[0]).toMatchObject({
      metric: 'Test metric',
      consecutive_count: 7,
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      signal: { metric: 'Test metric', consecutive_count: 7 },
    });
    expect(alertDiscordMock).toHaveBeenCalledTimes(1);
  });

  it('does not quarantine cross-metric mismatches without three for one metric', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Metric A', 'mismatch')],
        [result('Metric B', 'mismatch')],
        [result('Metric C', 'mismatch')],
      ]),
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    const output = await persistentMismatchClass.run({ step: passthroughStep, recorder });

    expect(output.actions).toBe(0);
    expect(supabase.writes.inserts).toHaveLength(0);
    expect(supabase.writes.upserts).toHaveLength(0);
    expect(supabase.writes.updates).toHaveLength(0);
    expect(records).toHaveLength(0);
    expect(alertDiscordMock).not.toHaveBeenCalled();
  });

  it('aborts the candidate when the existing-row read errors: no Discord, no audit, no write', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
      ]),
      errors: { readError: { message: 'simulated RLS denial' } },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    await expect(persistentMismatchClass.run({ step: passthroughStep, recorder })).rejects.toThrow(
      /simulated RLS denial/,
    );

    expect(supabase.writes.inserts).toHaveLength(0);
    expect(supabase.writes.upserts).toHaveLength(0);
    expect(supabase.writes.updates).toHaveLength(0);
    expect(records).toHaveLength(0);
    expect(alertDiscordMock).not.toHaveBeenCalled();
  });

  it('aborts the candidate when the insert errors: DB write throws before Discord/audit fire', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
      ]),
      errors: { insertError: { message: 'simulated insert failure' } },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    await expect(persistentMismatchClass.run({ step: passthroughStep, recorder })).rejects.toThrow(
      /simulated insert failure/,
    );

    expect(supabase.writes.inserts).toHaveLength(0);
    expect(records).toHaveLength(0);
    expect(alertDiscordMock).not.toHaveBeenCalled();
  });

  it('aborts the candidate when the refresh update errors: no spurious audit, no Discord', async () => {
    const supabase = makeSupabase({
      rows: reconciliationRows([
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
        [result('Test metric', 'mismatch')],
      ]),
      quarantined: new Map([
        [
          'Test metric',
          {
            metric: 'Test metric',
            expires_at: '2026-05-30T12:00:00.000Z',
            consecutive_count: 3,
          },
        ],
      ]),
      errors: { updateError: { message: 'simulated update failure' } },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.client);

    const { recorder, records } = makeRecorder();
    await expect(persistentMismatchClass.run({ step: passthroughStep, recorder })).rejects.toThrow(
      /simulated update failure/,
    );

    expect(supabase.writes.updates).toHaveLength(0);
    expect(records).toHaveLength(0);
    expect(alertDiscordMock).not.toHaveBeenCalled();
  });

  it('stress: 100 walker ticks against an active quarantine fire exactly one alert/audit and 99 refreshes', async () => {
    const baseRows = reconciliationRows([
      [result('Test metric', 'mismatch')],
      [result('Test metric', 'mismatch')],
      [result('Test metric', 'mismatch')],
    ]);

    // Shared mutable map so the insert in tick 1 is visible to the read in tick 2.
    const quarantined = new Map<string, QuarantinedMetric>();
    const writes = {
      inserts: 0,
      upserts: 0,
      updates: 0,
    };

    const insertHook = (payload: Record<string, unknown>) => {
      writes.inserts += 1;
      quarantined.set(payload.metric as string, {
        metric: payload.metric as string,
        expires_at: payload.expires_at as string,
        consecutive_count: payload.consecutive_count as number,
      });
    };

    const updateHook = (metric: string, payload: Record<string, unknown>) => {
      writes.updates += 1;
      const row = quarantined.get(metric);
      if (row) {
        quarantined.set(metric, {
          ...row,
          consecutive_count: payload.consecutive_count as number,
        });
      }
    };

    const client = {
      from(table: string) {
        if (table === 'reconciliation_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn(async () => ({ data: baseRows, error: null })),
              }),
            }),
          };
        }
        if (table === 'quarantined_metrics') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn((_col: string, metric: string) => ({
                maybeSingle: vi.fn(async () => ({
                  data: quarantined.get(metric) ?? null,
                  error: null,
                })),
              })),
            }),
            insert: vi.fn(async (payload: Record<string, unknown>) => {
              insertHook(payload);
              return { error: null };
            }),
            upsert: vi.fn(async (payload: Record<string, unknown>) => {
              writes.upserts += 1;
              insertHook(payload);
              return { error: null };
            }),
            update: vi.fn((payload: Record<string, unknown>) => ({
              eq: vi.fn(async (_col: string, metric: string) => {
                updateHook(metric, payload);
                return { error: null };
              }),
            })),
          };
        }
        throw new Error(`Unexpected table in test: ${table}`);
      },
    };
    getSupabaseAdminMock.mockReturnValue(client);

    const { recorder, records } = makeRecorder();
    for (let i = 0; i < 100; i++) {
      await persistentMismatchClass.run({ step: passthroughStep, recorder });
    }

    expect(writes.inserts).toBe(1);
    expect(writes.upserts).toBe(0);
    expect(writes.updates).toBe(99);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      action: 'quarantine_metric',
      success: true,
      escalated: true,
    });
    expect(alertDiscordMock).toHaveBeenCalledTimes(1);
  });
});
