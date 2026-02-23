/**
 * DRep Scoring and Metrics Calculations
 */

import { DRepVote } from '@/types/koios';
import { ValuePreference, VoteRecord } from '@/types/drep';
import { isValidatedSocialLink } from '@/utils/display';

// ---------------------------------------------------------------------------
// V2 Scoring Constants
// ---------------------------------------------------------------------------

export const MIN_RATIONALE_LENGTH = 50;

export interface ProposalContext {
  proposalType: string;
  treasuryTier: string | null;
}

/**
 * Size tier categories based on voting power
 */
export type SizeTier = 'Small' | 'Medium' | 'Large' | 'Whale';

/**
 * Get size tier based on voting power in ADA
 * - Small: < 100,000 ADA (individual holders, emerging DReps)
 * - Medium: 100,000 - 5,000,000 ADA (established community DReps)
 * - Large: 5,000,000 - 50,000,000 ADA (major ecosystem players)
 * - Whale: > 50,000,000 ADA (concentration risk, institutional scale)
 */
export function getSizeTier(votingPowerAda: number): SizeTier {
  if (votingPowerAda < 100_000) return 'Small';
  if (votingPowerAda < 5_000_000) return 'Medium';
  if (votingPowerAda < 50_000_000) return 'Large';
  return 'Whale';
}

/**
 * Get badge styling class for size tier
 */
export function getSizeBadgeClass(tier: SizeTier): string {
  switch (tier) {
    case 'Small':
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
    case 'Medium':
      return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
    case 'Large':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    case 'Whale':
      return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
  }
}

/**
 * Calculate participation rate
 * @param votesCount Number of votes cast
 * @param totalProposals Total number of proposals during active period
 * @returns Participation rate as percentage (0-100)
 */
export function calculateParticipationRate(
  votesCount: number,
  totalProposals: number
): number {
  if (totalProposals === 0) return 0;
  return Math.min(100, Math.round((votesCount / totalProposals) * 100));
}

/**
 * Calculate rationale provision rate
 * @param votes Array of vote records
 * @returns Percentage of votes with rationale provided (0-100)
 */
export function calculateRationaleRate(votes: DRepVote[] | VoteRecord[]): number {
  if (votes.length === 0) return 0;
  
  const votesWithRationale = votes.filter(vote => {
    if ('meta_url' in vote) {
      return vote.meta_url !== null
        || vote.meta_json?.rationale != null
        || vote.meta_json?.body?.comment != null
        || vote.meta_json?.body?.rationale != null;
    }
    return vote.hasRationale;
  }).length;
  
  return Math.round((votesWithRationale / votes.length) * 100);
}

/**
 * Calculate deliberation modifier based on vote uniformity
 * Penalizes rubber-stamping (voting the same way >85% of the time)
 * 
 * @param yesVotes Number of Yes votes
 * @param noVotes Number of No votes
 * @param abstainVotes Number of Abstain votes
 * @returns Modifier between 0.70 and 1.00
 */
export function calculateDeliberationModifier(
  yesVotes: number,
  noVotes: number,
  abstainVotes: number
): number {
  const totalVotes = yesVotes + noVotes + abstainVotes;
  
  if (totalVotes <= 10) return 1.0;
  
  const dominantCount = Math.max(yesVotes, noVotes, abstainVotes);
  const dominantRatio = dominantCount / totalVotes;
  
  if (dominantRatio > 0.95) return 0.70;
  if (dominantRatio > 0.90) return 0.85;
  if (dominantRatio > 0.85) return 0.95;
  return 1.0;
}

/**
 * Calculate consistency score based on voting activity across epochs.
 * Normalizes vote counts by proposals available each epoch so DReps aren't
 * penalized for voting on many proposals in busy epochs.
 *
 * @param epochVoteCounts Array of vote counts per epoch (index = epoch offset from first active epoch)
 * @param firstEpoch The first epoch in the array
 * @param proposalCountsByEpoch Map of epoch -> number of proposals available that epoch
 * @returns Consistency score (0-100)
 */
export function calculateConsistency(
  epochVoteCounts: number[],
  firstEpoch?: number,
  proposalCountsByEpoch?: Map<number, number>
): number {
  if (!epochVoteCounts || epochVoteCounts.length === 0) return 0;
  if (epochVoteCounts.length === 1) return epochVoteCounts[0] > 0 ? 50 : 0;

  // Normalize vote counts by proposals available per epoch
  let relevantRates: number[] = [];
  let relevantEpochCount = 0;

  if (proposalCountsByEpoch && proposalCountsByEpoch.size > 0 && firstEpoch !== undefined) {
    for (let i = 0; i < epochVoteCounts.length; i++) {
      const epoch = firstEpoch + i;
      const proposalCount = proposalCountsByEpoch.get(epoch);
      if (proposalCount && proposalCount > 0) {
        relevantEpochCount++;
        relevantRates.push(Math.min(1, epochVoteCounts[i] / proposalCount));
      }
    }

    if (relevantEpochCount === 0) return 50;
    if (relevantEpochCount === 1) return relevantRates[0] > 0 ? 50 : 0;
  } else {
    // Fallback: use raw counts when proposal data unavailable
    relevantRates = epochVoteCounts.map(c => c);
    relevantEpochCount = epochVoteCounts.length;
  }

  const nonZeroRates = relevantRates.filter(r => r > 0);
  if (nonZeroRates.length === 0) return 0;

  const mean = nonZeroRates.reduce((a, b) => a + b, 0) / nonZeroRates.length;
  if (mean === 0) return 0;

  const variance = nonZeroRates.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nonZeroRates.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  const activeEpochRatio = nonZeroRates.length / relevantEpochCount;
  const consistencyFromCV = Math.max(0, 1 - coefficientOfVariation);
  const combinedScore = (consistencyFromCV * 0.6 + activeEpochRatio * 0.4) * 100;

  return Math.round(Math.max(0, Math.min(100, combinedScore)));
}

/**
 * Calculate effective participation (participation rate with deliberation modifier)
 * 
 * @param participationRate Raw participation rate (0-100)
 * @param deliberationModifier Modifier from calculateDeliberationModifier (0.70-1.0)
 * @returns Effective participation rate (0-100)
 */
export function calculateEffectiveParticipation(
  participationRate: number,
  deliberationModifier: number
): number {
  return Math.round(participationRate * deliberationModifier);
}

// ---------------------------------------------------------------------------
// V2: Profile Completeness (CIP-119 metadata)
// ---------------------------------------------------------------------------

function extractStringValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && '@value' in (value as object)) {
    const inner = (value as Record<string, unknown>)['@value'];
    if (typeof inner === 'string') return inner.trim() || null;
  }
  return null;
}

/**
 * Calculate profile completeness from CIP-119 metadata body.
 * givenName 15pts, objectives 20pts, motivations 15pts,
 * qualifications 10pts, bio 10pts, validated social links 25-30pts.
 */
export function calculateProfileCompleteness(
  metadata: Record<string, unknown> | null
): number {
  if (!metadata) return 0;

  let score = 0;

  if (extractStringValue(metadata.givenName) || extractStringValue(metadata.name)) score += 15;
  if (extractStringValue(metadata.objectives)) score += 20;
  if (extractStringValue(metadata.motivations)) score += 15;
  if (extractStringValue(metadata.qualifications)) score += 10;
  if (extractStringValue(metadata.bio)) score += 10;

  const references = metadata.references;
  if (Array.isArray(references)) {
    let validCount = 0;
    for (const ref of references) {
      if (ref && typeof ref === 'object' && 'uri' in ref) {
        const { uri, label } = ref as { uri: string; label?: string };
        if (uri && isValidatedSocialLink(uri, label)) validCount++;
      }
    }
    if (validCount >= 2) score += 30;
    else if (validCount >= 1) score += 25;
  }

  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// V2: Proposal-Type-Weighted Rationale
// ---------------------------------------------------------------------------

const CRITICAL_PROPOSAL_TYPES = [
  'HardForkInitiation', 'NoConfidence',
  'NewConstitutionalCommittee', 'UpdateConstitution',
];

const RATIONALE_EXEMPT_TYPES = ['InfoAction'];

function getProposalImportanceWeight(ctx: ProposalContext): number {
  if (CRITICAL_PROPOSAL_TYPES.includes(ctx.proposalType)) return 3;
  if (ctx.proposalType === 'ParameterChange') return 2;
  if (
    ctx.proposalType === 'TreasuryWithdrawals' &&
    (ctx.treasuryTier === 'significant' || ctx.treasuryTier === 'major')
  ) return 2;
  return 1;
}

/**
 * Check if a vote has quality rationale (>= MIN_RATIONALE_LENGTH chars).
 * Gives benefit of the doubt when rationale is hosted externally and not yet fetched.
 */
export function hasQualityRationale(vote: DRepVote, resolvedText?: string): boolean {
  if (resolvedText !== undefined) {
    return resolvedText.length >= MIN_RATIONALE_LENGTH;
  }

  const inline =
    vote.meta_json?.body?.comment ||
    vote.meta_json?.body?.rationale ||
    vote.meta_json?.rationale;

  if (typeof inline === 'string') {
    return inline.length >= MIN_RATIONALE_LENGTH;
  }

  if (vote.meta_url !== null) return true;
  return false;
}

/**
 * Calculate rationale rate weighted by proposal importance.
 * Critical (3x), Important (2x), Standard (1x).
 * InfoActions are excluded entirely (non-binding polls don't need rationale).
 * Falls back to equal weights when proposal context is unavailable.
 */
export function calculateWeightedRationaleRate(
  votes: DRepVote[],
  proposalMap: Map<string, ProposalContext>,
  rationaleTexts?: Map<string, string>
): number {
  if (votes.length === 0) return 0;

  let weightedRationale = 0;
  let totalWeight = 0;

  for (const vote of votes) {
    const key = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
    const ctx = proposalMap.get(key);

    if (ctx && RATIONALE_EXEMPT_TYPES.includes(ctx.proposalType)) {
      continue;
    }

    const weight = ctx ? getProposalImportanceWeight(ctx) : 1;
    const resolved = rationaleTexts?.get(vote.vote_tx_hash);

    totalWeight += weight;
    if (hasQualityRationale(vote, resolved)) {
      weightedRationale += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedRationale / totalWeight) * 100);
}

// ---------------------------------------------------------------------------
// V2: Forgiving Rationale Curve
// ---------------------------------------------------------------------------

/**
 * Apply tiered curve to rationale rate so early effort is rewarded more.
 * 0-20% raw  -> 0-30 adjusted  (1.5x, rewards initial effort)
 * 20-60% raw -> 30-70 adjusted (1.0x, linear middle)
 * 60-100% raw -> 70-100 adjusted (0.75x, diminishing returns)
 */
export function applyRationaleCurve(rawRate: number): number {
  const rate = Math.max(0, Math.min(100, rawRate));

  let adjusted: number;
  if (rate <= 20) {
    adjusted = (rate / 20) * 30;
  } else if (rate <= 60) {
    adjusted = 30 + ((rate - 20) / 40) * 40;
  } else {
    adjusted = 70 + ((rate - 60) / 40) * 30;
  }

  return Math.round(Math.max(0, Math.min(100, adjusted)));
}

// ---------------------------------------------------------------------------
// Legacy / Utilities
// ---------------------------------------------------------------------------

/**
 * Calculate abstention penalty
 * Excessive abstentions reduce overall effectiveness
 * 
 * @param votes Array of vote records
 * @returns Penalty percentage (0-100, higher = worse)
 */
export function calculateAbstentionPenalty(votes: DRepVote[]): number {
  if (votes.length === 0) return 0;
  
  const abstentions = votes.filter(vote => vote.vote === 'Abstain').length;
  const abstentionRate = (abstentions / votes.length) * 100;
  
  // Mild penalty for <25%, moderate for 25-50%, severe for >50%
  if (abstentionRate < 25) return Math.round(abstentionRate * 0.5);
  if (abstentionRate < 50) return Math.round(abstentionRate * 0.75);
  return Math.round(abstentionRate);
}

/**
 * Calculate value alignment score
 * Matches DRep voting patterns with user's value preferences
 * 
 * @param votes Array of DRep votes
 * @param userValues Selected value preferences
 * @returns Alignment score (0-100)
 */
export function calculateValueAlignment(
  votes: DRepVote[],
  userValues: ValuePreference[]
): number {
  if (userValues.length === 0 || votes.length === 0) return 0;
  
  let totalScore = 0;
  let scoredValues = 0;
  
  for (const value of userValues) {
    let valueScore = 0;
    
    switch (value) {
      case 'High Participation': {
        // Reward high participation (non-abstain votes)
        const participationRate = votes.filter(v => v.vote !== 'Abstain').length / votes.length;
        valueScore = participationRate * 100;
        break;
      }
      
      case 'Active Rationale Provider': {
        // Reward providing rationale
        valueScore = calculateRationaleRate(votes);
        break;
      }
      
      case 'Treasury Conservative': {
        // Reward 'No' votes on treasury spending proposals
        // This is a simplified heuristic - would need proposal type analysis
        const noVoteRate = votes.filter(v => v.vote === 'No').length / votes.length;
        valueScore = noVoteRate * 100;
        break;
      }
      
      case 'Pro-DeFi': {
        // Reward 'Yes' votes (simplified - would need proposal type analysis)
        const yesVoteRate = votes.filter(v => v.vote === 'Yes').length / votes.length;
        valueScore = yesVoteRate * 70; // Weight lower as this is a rough heuristic
        break;
      }
      
      case 'Pro-Privacy': {
        // Placeholder - would need proposal content analysis
        // For now, give moderate score based on rationale provision
        valueScore = calculateRationaleRate(votes) * 0.5;
        break;
      }
      
      case 'Pro-Decentralization': {
        // Placeholder - would need proposal content analysis
        // Give moderate score based on consistent voting (not just abstaining)
        const activeVoteRate = votes.filter(v => v.vote !== 'Abstain').length / votes.length;
        valueScore = activeVoteRate * 70;
        break;
      }
    }
    
    totalScore += valueScore;
    scoredValues++;
  }
  
  return scoredValues > 0 ? Math.round(totalScore / scoredValues) : 0;
}

/**
 * Get vote distribution
 * @param votes Array of vote records
 * @returns Object with counts for each vote type
 */
export function getVoteDistribution(votes: DRepVote[]) {
  return {
    yes: votes.filter(v => v.vote === 'Yes').length,
    no: votes.filter(v => v.vote === 'No').length,
    abstain: votes.filter(v => v.vote === 'Abstain').length,
    total: votes.length,
  };
}

/**
 * Format voting power from lovelace to ADA
 * @param lovelace Voting power in lovelace (string)
 * @returns Voting power in ADA (number)
 */
export function lovelaceToAda(lovelace: string): number {
  return parseInt(lovelace, 10) / 1_000_000;
}

/**
 * Format ADA with commas
 * @param ada Amount in ADA
 * @returns Formatted string
 */
export function formatAda(ada: number): string {
  return ada.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Get color class for participation rate
 * @param rate Participation rate (0-100)
 * @returns Tailwind color class
 */
export function getParticipationColor(rate: number): string {
  if (rate >= 70) return 'text-green-600 dark:text-green-400';
  if (rate >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get badge variant for DRep Score (0-100)
 * Green ≥80, Yellow 60-79, Red <60
 */
export function getDRepScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 80) return 'default'; // green
  if (score >= 60) return 'secondary'; // yellow
  return 'destructive'; // red
}

/**
 * Get badge/background color class for DRep Score
 */
export function getDRepScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
  if (score >= 60) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
}

/**
 * Get color class for rationale rate
 * @param rate Rationale rate (0-100)
 * @returns Tailwind color class
 */
export function getRationaleColor(rate: number): string {
  if (rate >= 80) return 'text-green-600 dark:text-green-400';
  if (rate >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-orange-600 dark:text-orange-400';
}

/**
 * Shorten DRep ID for display
 * @param drepId Full DRep ID
 * @param prefixLength Characters to show at start
 * @param suffixLength Characters to show at end
 * @returns Shortened ID with ellipsis
 */
export function shortenDRepId(
  drepId: string,
  prefixLength: number = 8,
  suffixLength: number = 6
): string {
  if (drepId.length <= prefixLength + suffixLength) return drepId;
  return `${drepId.slice(0, prefixLength)}...${drepId.slice(-suffixLength)}`;
}
