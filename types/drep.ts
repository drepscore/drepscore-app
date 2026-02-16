/**
 * DRep Application Types
 * Used across components and API routes
 */

export type ValuePreference =
  | 'Treasury Conservative'
  | 'Pro-DeFi'
  | 'High Participation'
  | 'Pro-Privacy'
  | 'Pro-Decentralization'
  | 'Active Rationale Provider';

export interface DRep {
  drepId: string;
  drepHash: string;
  handle: string | null;
  name: string | null;
  ticker: string | null;
  description: string | null;
  votingPower: number;
  votingPowerLovelace: string;
  participationRate: number;
  rationaleRate: number;
  decentralizationScore: number;
  delegatorCount: number;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  isActive: boolean;
  anchorUrl: string | null;
  metadata: Record<string, unknown> | null;
}

export interface VoteRecord {
  id: string;
  proposalTxHash: string;
  proposalIndex: number;
  voteTxHash: string;
  date: Date;
  vote: 'Yes' | 'No' | 'Abstain';
  title: string;
  abstract: string | null;
  hasRationale: boolean;
  rationaleUrl: string | null;
  rationaleText: string | null;
  voteType: 'Governance' | 'Catalyst';
}

export interface KoiosError {
  message: string;
  retryable: boolean;
}
