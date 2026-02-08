/**
 * DRep Scoring and Metrics Calculations
 */

import { DRepVote } from '@/types/koios';
import { ValuePreference, VoteRecord } from '@/types/drep';

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
      return vote.meta_url !== null || vote.meta_json !== null;
    }
    return vote.hasRationale;
  }).length;
  
  return Math.round((votesWithRationale / votes.length) * 100);
}

/**
 * Calculate decentralization score
 * Based on the distribution of delegators and voting power
 * Higher score = more decentralized (many delegators, lower concentration)
 * 
 * @param delegatorCount Number of unique delegators
 * @param votingPowerAda Voting power in ADA
 * @returns Decentralization score (0-100)
 */
export function calculateDecentralizationScore(
  delegatorCount: number,
  votingPowerAda: number
): number {
  if (delegatorCount === 0 || votingPowerAda === 0) return 0;
  
  // Calculate average stake per delegator
  const avgStakePerDelegator = votingPowerAda / delegatorCount;
  
  // Ideal scenario: many delegators with balanced stakes
  // Penalize both: few delegators (centralized) and very low avg (whale dominance indicator)
  
  // Score based on delegator count (logarithmic scale)
  const delegatorScore = Math.min(50, Math.log10(delegatorCount + 1) * 20);
  
  // Score based on distribution (inverse of concentration)
  // Lower average stake per delegator = better distribution
  const distributionScore = Math.min(50, 50 - Math.log10(avgStakePerDelegator + 1) * 3);
  
  return Math.round(Math.max(0, delegatorScore + distributionScore));
}

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
