/**
 * DRep Application Types
 * Used across components and API routes
 */

import { SizeTier } from '@/utils/scoring';

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
  consistencyScore: number;
  deliberationModifier: number;
  effectiveParticipation: number;
  sizeTier: SizeTier;
  delegatorCount: number;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  isActive: boolean;
  anchorUrl: string | null;
  metadata: Record<string, unknown> | null;
  epochVoteCounts?: number[];
  profileCompleteness: number;
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
  aiSummary: string | null;
  hasRationale: boolean;
  rationaleUrl: string | null;
  rationaleText: string | null;
  voteType: 'Governance' | 'Catalyst';
  proposalType: string | null;
  treasuryTier: string | null;
  withdrawalAmount: number | null;
  relevantPrefs: string[];
}

export type VoteAlignmentStatus = 'aligned' | 'unaligned' | 'neutral';

export interface VoteAlignment {
  status: VoteAlignmentStatus;
  reasons: string[];
}

export interface KoiosError {
  message: string;
  retryable: boolean;
}

export type UserPrefKey =
  | 'treasury-conservative'
  | 'smart-treasury-growth'
  | 'strong-decentralization'
  | 'protocol-security-first'
  | 'innovation-defi-growth'
  | 'responsible-governance';

export interface UserPrefs {
  hasSeenOnboarding: boolean;
  userPrefs: UserPrefKey[];
}
