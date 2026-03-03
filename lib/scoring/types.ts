/**
 * Shared types for the DRep Score V3 scoring pipeline.
 * All pillar modules consume these; the Inngest sync function constructs them.
 */

// Temporal decay: half-life of 180 days (~6 months)
export const DECAY_HALF_LIFE_DAYS = 180;
export const DECAY_LAMBDA = Math.LN2 / DECAY_HALF_LIFE_DAYS;

export const PILLAR_WEIGHTS = {
  engagementQuality: 0.35,
  effectiveParticipation: 0.25,
  reliability: 0.25,
  governanceIdentity: 0.15,
} as const;

export interface VoteData {
  drepId: string;
  proposalKey: string; // `${tx_hash}-${index}`
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number; // unix seconds
  proposalBlockTime: number; // unix seconds
  proposalType: string;
  rationaleQuality: number | null;
  importanceWeight: number;
}

export interface ProposalScoringContext {
  proposalKey: string;
  proposalType: string;
  treasuryTier: string | null;
  withdrawalAmount: number | null;
  blockTime: number;
  importanceWeight: number;
}

export interface ProposalVotingSummary {
  proposalKey: string;
  drepYesVotePower: number;
  drepNoVotePower: number;
  drepAbstainVotePower: number;
}

export interface DRepProfileData {
  drepId: string;
  metadata: Record<string, unknown> | null;
  delegatorCount: number;
  metadataHashVerified: boolean;
  brokenUris?: Set<string>;
}

export interface DRepScoreResult {
  composite: number;
  engagementQualityRaw: number;
  engagementQualityPercentile: number;
  effectiveParticipationRaw: number;
  effectiveParticipationPercentile: number;
  reliabilityRaw: number;
  reliabilityPercentile: number;
  governanceIdentityRaw: number;
  governanceIdentityPercentile: number;
  momentum: number | null;
}
