/**
 * DRep Scoring and Metrics Calculations
 */

import { DRepVote } from '@/types/koios';
import { ValuePreference, VoteRecord } from '@/types/drep';

/**
 * Size tier categories based on voting power
 */
export type SizeTier = 'Small' | 'Medium' | 'Large' | 'Whale';

/**
 * Get size tier based on voting power in ADA
 * - Small: < 10,000 ADA (emerging DReps)
 * - Medium: 10,000 - 1,000,000 ADA (healthy engagement)
 * - Large: 1,000,000 - 10,000,000 ADA (established DReps)
 * - Whale: > 10,000,000 ADA (high concentration)
 */
export function getSizeTier(votingPowerAda: number): SizeTier {
  if (votingPowerAda < 10_000) return 'Small';
  if (votingPowerAda < 1_000_000) return 'Medium';
  if (votingPowerAda < 10_000_000) return 'Large';
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
      return vote.meta_url !== null || vote.meta_json !== null;
    }
    return vote.hasRationale;
  }).length;
  
  return Math.round((votesWithRationale / votes.length) * 100);
}

/**
 * Calculate Governance Engagement Score
 * Measures DRep quality based on activity, voting independence, and power balance
 * (Replaces delegator-based decentralization score since Koios API doesn't provide delegator data)
 * 
 * @param participationRate Participation rate (0-100)
 * @param rationaleRate Rationale provision rate (0-100)
 * @param votingPowerAda Voting power in ADA
 * @param yesVotes Number of Yes votes
 * @param noVotes Number of No votes
 * @param abstainVotes Number of Abstain votes
 * @returns Governance engagement score (0-100)
 */
export function calculateDecentralizationScore(
  participationRate: number,
  rationaleRate: number,
  votingPowerAda: number,
  yesVotes: number,
  noVotes: number,
  abstainVotes: number
): number {
  const totalVotes = yesVotes + noVotes + abstainVotes;
  
  if (totalVotes === 0) return 0;
  
  // 1. Activity Score (40%)
  // Combination of participation rate and rationale provision
  const activityScore = (participationRate * 0.6 + rationaleRate * 0.4) * 0.4;
  
  // 2. Voting Independence Score (30%)
  // Calculate entropy of vote distribution (balanced voting = independent thinking)
  const yesRatio = yesVotes / totalVotes;
  const noRatio = noVotes / totalVotes;
  const abstainRatio = abstainVotes / totalVotes;
  
  // Calculate Shannon entropy, normalize to 0-1 scale
  let entropy = 0;
  if (yesRatio > 0) entropy -= yesRatio * Math.log2(yesRatio);
  if (noRatio > 0) entropy -= noRatio * Math.log2(noRatio);
  if (abstainRatio > 0) entropy -= abstainRatio * Math.log2(abstainRatio);
  
  // Max entropy for 3 categories is log2(3) ≈ 1.585
  const maxEntropy = Math.log2(3);
  const normalizedEntropy = entropy / maxEntropy;
  const independenceScore = normalizedEntropy * 30;
  
  // 3. Power Balance Score (30%)
  // Tier-based scoring: penalize extremes, reward moderate stake
  let powerScore = 0;
  if (votingPowerAda < 1000) {
    // Very low power: likely inactive or new
    powerScore = 5;
  } else if (votingPowerAda < 10000) {
    // Low power: emerging DRep
    powerScore = 15;
  } else if (votingPowerAda < 100000) {
    // Moderate power: healthy engagement (best tier)
    powerScore = 30;
  } else if (votingPowerAda < 1000000) {
    // High power: established DRep
    powerScore = 25;
  } else if (votingPowerAda < 10000000) {
    // Very high power: potential whale risk
    powerScore = 15;
  } else {
    // Extreme power: whale warning
    powerScore = 5;
  }
  
  const totalScore = activityScore + independenceScore + powerScore;
  
  return Math.round(Math.max(0, Math.min(100, totalScore)));
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
