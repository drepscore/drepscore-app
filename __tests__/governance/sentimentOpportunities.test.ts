import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

import { getCitizenSentimentOpportunities } from '@/lib/governance/sentimentOpportunities';

interface ProposalRow {
  tx_hash: string | null;
  proposal_index: number | null;
  title: string | null;
  proposal_type: string | null;
  expiration_epoch: number | null;
  block_time: number | null;
}

interface QueryError {
  message: string;
}

function proposal(overrides: Partial<ProposalRow>): ProposalRow {
  return {
    tx_hash: 'tx-default',
    proposal_index: 0,
    title: 'Default proposal',
    proposal_type: 'InfoAction',
    expiration_epoch: 300,
    block_time: 1_000,
    ...overrides,
  };
}

function mockProposalQuery(rows: ProposalRow[], error: QueryError | null = null) {
  const result = { data: rows, error };
  const query = {
    select: vi.fn(() => query),
    is: vi.fn(() => query),
    not: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn((column: string) => (column === 'block_time' ? Promise.resolve(result) : query)),
  };

  mockGetSupabaseAdmin.mockReturnValue({
    from: vi.fn(() => query),
  });

  return query;
}

describe('getCitizenSentimentOpportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads active proposals and maps node-anchor fields for citizen sentiment', async () => {
    const query = mockProposalQuery([
      proposal({
        tx_hash: 'tx-expiring-first',
        proposal_index: 2,
        title: 'Expiring proposal',
        proposal_type: 'TreasuryWithdrawals',
        expiration_epoch: 250,
      }),
      proposal({
        tx_hash: 'tx-expiring-second',
        proposal_index: 0,
        title: null,
        proposal_type: 'InfoAction',
        expiration_epoch: 275,
      }),
    ]);

    const opportunities = await getCitizenSentimentOpportunities(
      new Date('2026-05-22T12:00:00.000Z'),
    );

    expect(query.select).toHaveBeenCalledWith(
      'tx_hash, proposal_index, title, proposal_type, expiration_epoch, block_time',
    );
    expect(query.is).toHaveBeenCalledWith('ratified_epoch', null);
    expect(query.is).toHaveBeenCalledWith('enacted_epoch', null);
    expect(query.is).toHaveBeenCalledWith('dropped_epoch', null);
    expect(query.is).toHaveBeenCalledWith('expired_epoch', null);
    expect(query.order).toHaveBeenNthCalledWith(1, 'expiration_epoch', {
      ascending: true,
      nullsFirst: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, 'block_time', {
      ascending: false,
      nullsFirst: false,
    });
    expect(opportunities).toEqual([
      {
        id: 'proposal:tx-expiring-first:2',
        title: 'Expiring proposal',
        proposalType: 'TreasuryWithdrawals',
        txHash: 'tx-expiring-first',
        proposalIndex: 2,
        expirationEpoch: 250,
      },
      {
        id: 'proposal:tx-expiring-second:0',
        title: null,
        proposalType: 'InfoAction',
        txHash: 'tx-expiring-second',
        proposalIndex: 0,
        expirationEpoch: 275,
      },
    ]);
  });

  it('drops malformed rows that cannot anchor a proposal node', async () => {
    mockProposalQuery([
      proposal({ tx_hash: null, proposal_index: 2 }),
      proposal({ tx_hash: 'tx-missing-index', proposal_index: null }),
      proposal({ tx_hash: 'tx-valid', proposal_index: 1 }),
    ]);

    const opportunities = await getCitizenSentimentOpportunities();

    expect(opportunities).toEqual([
      expect.objectContaining({
        txHash: 'tx-valid',
        proposalIndex: 1,
      }),
    ]);
  });

  it('throws a descriptive error when the proposals query fails', async () => {
    mockProposalQuery([], { message: 'database unavailable' });

    await expect(getCitizenSentimentOpportunities()).rejects.toThrow(
      'Failed to read citizen sentiment opportunities: database unavailable',
    );
  });
});
