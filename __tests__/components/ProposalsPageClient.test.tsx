import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProposalsPageClient } from '@/components/ProposalsPageClient';
import type { ProposalWithVoteSummary } from '@/lib/data';

let lastProps: { proposals: unknown[]; currentEpoch: number } | null = null;

vi.mock('@/components/ProposalsListClient', () => ({
  ProposalsListClient: (props: { proposals: unknown[]; currentEpoch: number }) => {
    lastProps = props;
    return <div data-testid="proposals-list">{props.proposals.length} proposals</div>;
  },
}));

const mockProposal: ProposalWithVoteSummary = {
  txHash: 'abc123',
  proposalIndex: 0,
  title: 'Test Proposal',
  abstract: 'A test',
  proposalType: 'InfoAction',
  withdrawalAmount: null,
  treasuryTier: null,
  relevantPrefs: [],
  proposedEpoch: 500,
  blockTime: 1700000000,
  expirationEpoch: 510,
  ratifiedEpoch: null,
  enactedEpoch: null,
  droppedEpoch: null,
  expiredEpoch: null,
  yesCount: 10,
  noCount: 2,
  abstainCount: 1,
  totalVotes: 13,
  voterDrepIds: [],
  aiSummary: null,
};

describe('ProposalsPageClient', () => {
  afterEach(() => {
    cleanup();
    lastProps = null;
  });

  it('renders with proposals and passes them to ProposalsListClient', () => {
    render(<ProposalsPageClient proposals={[mockProposal]} currentEpoch={500} />);
    expect(lastProps).toBeDefined();
    expect(lastProps!.proposals).toHaveLength(1);
    expect(lastProps!.currentEpoch).toBe(500);
  });

  it('renders with empty proposals', () => {
    render(<ProposalsPageClient proposals={[]} currentEpoch={500} />);
    expect(lastProps).toBeDefined();
    expect(lastProps!.proposals).toHaveLength(0);
  });
});
