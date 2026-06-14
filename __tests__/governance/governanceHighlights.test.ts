import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cachedMock,
  getCitizenSentimentOpportunitiesMock,
  getAllDRepsMock,
  executeShowControversyMock,
} = vi.hoisted(() => ({
  cachedMock: vi.fn(async (_key: string, _ttlSeconds: number, fetcher: () => Promise<unknown>) =>
    fetcher(),
  ),
  getCitizenSentimentOpportunitiesMock: vi.fn(),
  getAllDRepsMock: vi.fn(),
  executeShowControversyMock: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  cached: cachedMock,
}));

vi.mock('@/lib/governance/sentimentOpportunities', () => ({
  getCitizenSentimentOpportunities: getCitizenSentimentOpportunitiesMock,
}));

vi.mock('@/lib/data', () => ({
  getAllDReps: getAllDRepsMock,
}));

vi.mock('@/lib/intelligence/advisor-discovery-tools', () => ({
  executeShowControversy: executeShowControversyMock,
}));

import { getGovernanceHighlights } from '@/lib/governance/governanceHighlights';

describe('getGovernanceHighlights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCitizenSentimentOpportunitiesMock.mockResolvedValue([
      {
        id: 'proposal:tx-open:0',
        title: 'Open treasury proposal',
        proposalType: 'TreasuryWithdrawals',
        txHash: 'tx-open',
        proposalIndex: 0,
        expirationEpoch: 620,
      },
      {
        id: 'proposal:tx-protocol:1',
        title: 'Protocol update',
        proposalType: 'ParameterChange',
        txHash: 'tx-protocol',
        proposalIndex: 1,
        expirationEpoch: 621,
      },
      {
        id: 'proposal:tx-info:2',
        title: 'Info action',
        proposalType: 'InfoAction',
        txHash: 'tx-info',
        proposalIndex: 2,
        expirationEpoch: 622,
      },
    ]);
    getAllDRepsMock.mockResolvedValue({
      dreps: [],
      allDReps: [
        {
          drepId: 'drep1slow',
          name: 'Slow Delegate',
          handle: null,
          totalVotes: 10,
          lastVoteTime: 1_000,
        },
        {
          drepId: 'drep1ada',
          name: 'Ada Delegate',
          handle: 'ada',
          totalVotes: 42,
          lastVoteTime: 2_000,
        },
      ],
      error: false,
      totalAvailable: 2,
    });
    executeShowControversyMock.mockResolvedValue({
      result:
        '**Most controversial proposals** (DRep vs SPO voting split):\n1. "Treasury guardrails" — DReps 82% yes, SPOs 34% yes | abcdef123456#2',
      globeCommands: [
        {
          type: 'showControversy',
          proposalId: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890_2',
        },
      ],
    });
  });

  it('wraps existing governance reads into three cached anonymous highlights', async () => {
    const highlights = await getGovernanceHighlights(new Date('2026-06-14T12:00:00.000Z'));

    expect(cachedMock).toHaveBeenCalledWith(
      'governance-highlights:anon',
      300,
      expect.any(Function),
    );
    expect(getCitizenSentimentOpportunitiesMock).toHaveBeenCalledWith(
      new Date('2026-06-14T12:00:00.000Z'),
    );
    expect(getAllDRepsMock).toHaveBeenCalled();
    expect(executeShowControversyMock).toHaveBeenCalled();
    expect(highlights).toEqual([
      expect.objectContaining({
        id: 'open-proposals',
        kind: 'open_proposals',
        label: '3 proposals open now',
        href: '/governance/proposals',
      }),
      expect.objectContaining({
        id: 'contested-vote',
        kind: 'contested_vote',
        label: 'Hottest vote: Treasury guardrails',
        href: '/proposal/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890/2',
        globeCommand: { type: 'warmTopic', topic: 'proposals' },
      }),
      expect.objectContaining({
        id: 'active-representative',
        kind: 'active_representative',
        label: 'Most active this epoch: Ada Delegate',
        href: '/drep/drep1ada',
        globeCommand: { type: 'narrowTo', nodeIds: ['drep_drep1ada'], fly: false },
      }),
    ]);
  });

  it('drops the contested-vote link when only a truncated display hash is available', async () => {
    // Text line carries the 12-char display hash; no structured showControversy id.
    executeShowControversyMock.mockResolvedValue({
      result:
        '**Most controversial proposals** (DRep vs SPO voting split):\n1. "Treasury guardrails" — DReps 82% yes, SPOs 34% yes | abcdef123456#2',
      globeCommands: [],
    });

    const highlights = await getGovernanceHighlights();

    const contested = highlights.find((highlight) => highlight.id === 'contested-vote');
    // Degrades to the safe fallback card rather than emitting a broken /proposal/<short-hash> link.
    expect(contested?.label).toBe('Hottest vote: checking live splits');
    expect(contested?.href).toBe('/governance/proposals');
    expect(contested?.href).not.toContain('abcdef123456');
  });

  it('degrades to newcomer-safe highlight labels when sources fail', async () => {
    getCitizenSentimentOpportunitiesMock.mockRejectedValue(new Error('proposal read failed'));
    getAllDRepsMock.mockRejectedValue(new Error('drep read failed'));
    executeShowControversyMock.mockRejectedValue(new Error('controversy read failed'));

    const highlights = await getGovernanceHighlights();

    expect(highlights).toHaveLength(3);
    expect(highlights.map((highlight) => highlight.label)).toEqual([
      'Proposal feed updating now',
      'Hottest vote: checking live splits',
      'Most active this epoch: checking activity',
    ]);
    const renderedCopy = highlights
      .map((highlight) => `${highlight.label} ${highlight.body}`)
      .join(' ');
    expect(renderedCopy).not.toContain('quiet');
    expect(renderedCopy).not.toContain('Your representative');
  });
});
