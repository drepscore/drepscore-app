import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFunctionMock = vi.hoisted(() => vi.fn());
const fetchAllSPOVotesBulkMock = vi.hoisted(() => vi.fn());
const fetchAllCCVotesBulkMock = vi.hoisted(() => vi.fn());
const batchUpsertMock = vi.hoisted(() => vi.fn());
const syncLoggerInstances = vi.hoisted(
  () =>
    [] as Array<{
      syncType: string;
      start: ReturnType<typeof vi.fn>;
      finalize: ReturnType<typeof vi.fn>;
    }>,
);

vi.mock('@/lib/inngest', () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

vi.mock('@/utils/koios', () => ({
  fetchAllSPOVotesBulk: fetchAllSPOVotesBulkMock,
  fetchAllCCVotesBulk: fetchAllCCVotesBulkMock,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [] }),
    })),
  }),
}));

vi.mock('@/lib/sync-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sync-utils')>();
  return {
    ...actual,
    batchUpsert: batchUpsertMock,
    emitPostHog: vi.fn(),
    alertCritical: vi.fn(),
    SyncLogger: class {
      start = vi.fn().mockResolvedValue(undefined);
      finalize = vi.fn().mockResolvedValue(undefined);

      constructor(
        _supabase: unknown,
        public syncType: string,
      ) {
        syncLoggerInstances.push(this);
      }
    },
  };
});

vi.mock('@/lib/interBodyAlignment', () => ({
  computeAndCacheAlignment: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function makeStep() {
  return {
    run: vi.fn((name: string, fn: () => unknown) => {
      if (name === 'fetch-spo-votes' || name === 'fetch-cc-votes' || name === 'emit-analytics') {
        return fn();
      }
      if (name === 'compute-alignment') return { alignmentCached: 0 };
      if (name === 'snapshot-alignment') return { snapshotted: 0 };
      throw new Error(`Unexpected step: ${name}`);
    }),
    sendEvent: vi.fn(),
  };
}

describe('syncSpoAndCcVotes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    syncLoggerInstances.length = 0;
    createFunctionMock.mockImplementation((config, handler) => ({ config, handler }));
    fetchAllCCVotesBulkMock.mockResolvedValue([]);
    batchUpsertMock.mockResolvedValue({ success: 0, errors: 0, errorMessages: [] });
  });

  it('keeps the latest SPO vote for each database conflict key before upserting', async () => {
    fetchAllSPOVotesBulkMock.mockResolvedValue([
      {
        pool_id: 'pool1',
        proposal_tx_hash: 'proposal1',
        proposal_index: 0,
        vote: 'No',
        block_time: 100,
        tx_hash: 'old-vote',
        epoch: 500,
      },
      {
        pool_id: 'pool1',
        proposal_tx_hash: 'proposal1',
        proposal_index: 0,
        vote: 'Yes',
        block_time: 200,
        tx_hash: 'new-vote',
        epoch: 501,
      },
      {
        pool_id: 'pool2',
        proposal_tx_hash: 'proposal1',
        proposal_index: 0,
        vote: 'Abstain',
        block_time: 150,
        tx_hash: 'other-vote',
        epoch: 500,
      },
    ]);
    batchUpsertMock.mockImplementation(
      async (_supabase, _table, rows: Array<Record<string, unknown>>) => ({
        success: rows.length,
        errors: 0,
        errorMessages: [],
      }),
    );

    const { syncSpoAndCcVotes } = await import('@/inngest/functions/sync-spo-cc-votes');
    const fn = syncSpoAndCcVotes as unknown as {
      handler: (input: { step: ReturnType<typeof makeStep> }) => Promise<unknown>;
    };
    const result = await fn.handler({ step: makeStep() });

    const spoCall = batchUpsertMock.mock.calls.find((call) => call[1] === 'spo_votes');
    expect(spoCall?.[2]).toEqual([
      expect.objectContaining({ pool_id: 'pool1', vote: 'Yes', tx_hash: 'new-vote' }),
      expect.objectContaining({ pool_id: 'pool2', vote: 'Abstain', tx_hash: 'other-vote' }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        spo: { fetched: 3, deduplicated: 2, upserted: 2 },
      }),
    );
    expect(
      syncLoggerInstances.find((instance) => instance.syncType === 'spo_votes')?.finalize,
    ).toHaveBeenCalledWith(
      true,
      null,
      expect.objectContaining({
        spoVotesFetched: 3,
        spoVotesDeduplicated: 2,
        duplicatesRemoved: 1,
        upserted: 2,
        failed: 0,
      }),
    );
  });

  it('marks the SPO sync failed and retries the step when any batch rows fail', async () => {
    fetchAllSPOVotesBulkMock.mockResolvedValue([
      {
        pool_id: 'pool1',
        proposal_tx_hash: 'proposal1',
        proposal_index: 0,
        vote: 'Yes',
        block_time: 200,
        tx_hash: 'vote1',
        epoch: 501,
      },
    ]);
    batchUpsertMock.mockResolvedValue({
      success: 0,
      errors: 1,
      errorMessages: ['database rejected the batch'],
    });

    const { syncSpoAndCcVotes } = await import('@/inngest/functions/sync-spo-cc-votes');
    const fn = syncSpoAndCcVotes as unknown as {
      handler: (input: { step: ReturnType<typeof makeStep> }) => Promise<unknown>;
    };

    await expect(fn.handler({ step: makeStep() })).rejects.toThrow(
      'SPO votes upsert incomplete: 1 row(s) failed: database rejected the batch',
    );
    expect(
      syncLoggerInstances.find((instance) => instance.syncType === 'spo_votes')?.finalize,
    ).toHaveBeenCalledWith(
      false,
      'SPO votes upsert incomplete: 1 row(s) failed: database rejected the batch',
      expect.objectContaining({ upserted: 0, failed: 1 }),
    );
  });
});
