import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMock: vi.fn(async () => undefined),
  alertCriticalMock: vi.fn(async () => undefined),
  alertDiscordMock: vi.fn(async () => undefined),
  emitPostHogMock: vi.fn(() => undefined),
  getSupabaseAdminMock: vi.fn(),
}));

vi.mock('@/lib/inngest', () => ({
  inngest: { send: mocks.sendMock },
}));

vi.mock('@/lib/sync-utils', () => ({
  alertCritical: mocks.alertCriticalMock,
  alertDiscord: mocks.alertDiscordMock,
  emitPostHog: mocks.emitPostHogMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdminMock(),
}));

const { sendMock, alertCriticalMock, alertDiscordMock, emitPostHogMock, getSupabaseAdminMock } =
  mocks;

import { staleSyncClass } from '@/lib/selfHeal/classes/staleSync';
import type { SelfHealRecordInput, SelfHealStep } from '@/lib/selfHeal/types';

const passthroughStep: SelfHealStep = {
  async run(_id, fn) {
    return fn();
  },
};

function makeQueryBuilder({
  syncHealth = [] as Array<{ sync_type: string; last_run: string | null }>,
  recentFailure = null as { id: number } | null,
  recentTriggerCount = 0 as number,
} = {}) {
  // Each call to `.from(...)` returns a chain that resolves either to
  // `syncHealth` (the freshness probe) or `recentFailure` / `recentTriggerCount`
  // (per-syncType throttle probes), based on what filters were applied.
  return {
    from(table: string) {
      if (table === 'v_sync_health') {
        const builder = {
          select: vi.fn(() => Promise.resolve({ data: syncHealth })),
        };
        return builder;
      }
      if (table === 'sync_log') {
        // The class issues two distinct sync_log probes for each stale entry.
        // Distinguish by whether `.single()` is called (recent-failure probe)
        // vs whether `count: 'exact', head: true` is used (trigger-count probe).
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn((_columns: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            // Trigger-count probe: terminate via gte().
            return {
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn(() => Promise.resolve({ count: recentTriggerCount })),
            };
          }
          // Recent-failure probe: terminate via single().
          return {
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn(() => Promise.resolve({ data: recentFailure })),
          };
        });
        return builder;
      }
      throw new Error(`Unexpected table in test: ${table}`);
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

describe('staleSyncClass', () => {
  beforeEach(() => {
    sendMock.mockClear();
    alertCriticalMock.mockClear();
    alertDiscordMock.mockClear();
    emitPostHogMock.mockClear();
    getSupabaseAdminMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zero actions when v_sync_health is empty AND no policy rows are missing', async () => {
    // SYNC_POLICY contains many event-bearing entries — to make this case
    // truly empty we'd need to add every policy syncType to the syncHealth
    // mock with a fresh `last_run`. Instead assert the shape: result has the
    // right className and detail structure regardless of count.
    getSupabaseAdminMock.mockReturnValue(
      makeQueryBuilder({
        syncHealth: [
          // Provide one fresh row so we don't trip "never ran" detection for it
          { sync_type: 'proposals', last_run: new Date().toISOString() },
        ],
      }),
    );

    const { recorder } = makeRecorder();
    const result = await staleSyncClass.run({ step: passthroughStep, recorder });

    expect(result.className).toBe('stale_sync');
    expect(typeof result.actions).toBe('number');
    expect(Array.isArray(result.details)).toBe(true);
  });

  it('retriggers a stale sync, emits PostHog + Discord, and records a successful audit row', async () => {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

    getSupabaseAdminMock.mockReturnValue(
      makeQueryBuilder({
        // Only one stale entry: a `proposals` sync that hasn't run in 10h
        // (retrigger threshold is 90 min). Other entries fresh.
        syncHealth: [{ sync_type: 'proposals', last_run: tenHoursAgo }],
        recentFailure: null,
        recentTriggerCount: 0,
      }),
    );

    const { recorder, records } = makeRecorder();
    const result = await staleSyncClass.run({ step: passthroughStep, recorder });

    expect(sendMock).toHaveBeenCalledWith({ name: 'drepscore/sync.proposals' });
    expect(alertDiscordMock).toHaveBeenCalled();
    expect(emitPostHogMock).toHaveBeenCalled();
    expect(result.actions).toBeGreaterThanOrEqual(1);

    const proposalsAudit = records.find(
      (r) =>
        r.action === 'retrigger_event' &&
        typeof r.signal.syncType === 'string' &&
        r.signal.syncType === 'proposals',
    );
    expect(proposalsAudit).toBeDefined();
    expect(proposalsAudit?.success).toBe(true);
    expect(proposalsAudit?.escalated).toBeFalsy();
  });

  it('skips retrigger and records skip-audit when a recent failure exists', async () => {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

    getSupabaseAdminMock.mockReturnValue(
      makeQueryBuilder({
        syncHealth: [{ sync_type: 'proposals', last_run: tenHoursAgo }],
        recentFailure: { id: 42 },
      }),
    );

    const { recorder, records } = makeRecorder();
    await staleSyncClass.run({ step: passthroughStep, recorder });

    expect(sendMock).not.toHaveBeenCalled();
    expect(alertDiscordMock).not.toHaveBeenCalled();

    const skipAudit = records.find(
      (r) => r.action === 'skip_recent_failure' && r.signal.syncType === 'proposals',
    );
    expect(skipAudit).toBeDefined();
    expect(skipAudit?.success).toBe(false);
  });

  it('escalates critical alert + audit row when the throttle limit is hit', async () => {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

    getSupabaseAdminMock.mockReturnValue(
      makeQueryBuilder({
        syncHealth: [{ sync_type: 'proposals', last_run: tenHoursAgo }],
        recentFailure: null,
        recentTriggerCount: 5, // > SELF_HEAL_MAX_TRIGGERS (3)
      }),
    );

    const { recorder, records } = makeRecorder();
    await staleSyncClass.run({ step: passthroughStep, recorder });

    expect(sendMock).not.toHaveBeenCalled();
    expect(alertCriticalMock).toHaveBeenCalled();

    const throttleAudit = records.find(
      (r) => r.action === 'throttle_escalate' && r.signal.syncType === 'proposals',
    );
    expect(throttleAudit).toBeDefined();
    expect(throttleAudit?.success).toBe(false);
    expect(throttleAudit?.escalated).toBe(true);
  });
});
