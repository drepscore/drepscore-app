/**
 * Value Alignment Engine
 * Calculates alignment between user preferences and DRep voting behavior
 */

import { DRepVote } from '@/types/koios';
import { UserPrefKey } from '@/types/drep';
import { EnrichedDRep } from '@/lib/koios';

const TREASURY_KEYWORDS = ['treasury', 'withdrawal', 'budget', 'fund', 'spend', 'grant', 'funding'];

export interface AlignmentBreakdown {
  treasury: number;
  decentralization: number;
  security: number;
  innovation: number;
  transparency: number;
  overall: number;
}

export interface MismatchAlert {
  id: string;
  drepId: string;
  drepName: string;
  vote: 'Yes' | 'No' | 'Abstain';
  proposalTitle: string;
  conflictingPref: UserPrefKey;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Check if a vote is treasury-related based on metadata keywords
 */
export function isTreasuryVote(vote: DRepVote): boolean {
  const searchText = [
    vote.meta_json?.title,
    vote.meta_json?.abstract,
    vote.meta_json?.motivation,
    vote.meta_json?.rationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return TREASURY_KEYWORDS.some((keyword) => searchText.includes(keyword));
}

/**
 * Calculate alignment breakdown per preference category
 */
export function calculateAlignmentBreakdown(
  drep: EnrichedDRep,
  votes: DRepVote[],
  prefs: UserPrefKey[]
): AlignmentBreakdown {
  const breakdown: AlignmentBreakdown = {
    treasury: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
    overall: 50,
  };

  if (prefs.length === 0) {
    return breakdown;
  }

  const treasuryVotes = votes.filter(isTreasuryVote);
  const hasRationaleVotes = votes.filter(
    (v) => v.meta_url !== null || v.meta_json?.rationale != null
  );

  // Treasury Conservative: favor "No" votes on treasury proposals
  if (prefs.includes('treasury-conservative')) {
    if (treasuryVotes.length > 0) {
      const noVotes = treasuryVotes.filter((v) => v.vote === 'No').length;
      breakdown.treasury = Math.round((noVotes / treasuryVotes.length) * 100);
    } else {
      breakdown.treasury = drep.rationaleRate > 50 ? 60 : 50;
    }
  }

  // Treasury Growth-Oriented: favor "Yes" votes on treasury with rationale
  if (prefs.includes('smart-treasury-growth')) {
    if (treasuryVotes.length > 0) {
      const yesWithRationale = treasuryVotes.filter(
        (v) => v.vote === 'Yes' && (v.meta_url || v.meta_json?.rationale)
      ).length;
      breakdown.treasury = Math.round((yesWithRationale / treasuryVotes.length) * 100);
    } else {
      breakdown.treasury = drep.participationRate > 60 ? 60 : 50;
    }
  }

  // Handle conflict: if both treasury prefs selected, average them
  if (prefs.includes('treasury-conservative') && prefs.includes('smart-treasury-growth')) {
    const conservativeScore = treasuryVotes.length > 0
      ? Math.round((treasuryVotes.filter((v) => v.vote === 'No').length / treasuryVotes.length) * 100)
      : 50;
    const growthScore = treasuryVotes.length > 0
      ? Math.round(
          (treasuryVotes.filter((v) => v.vote === 'Yes' && (v.meta_url || v.meta_json?.rationale)).length /
            treasuryVotes.length) *
            100
        )
      : 50;
    breakdown.treasury = Math.round((conservativeScore + growthScore) / 2);
  }

  // Decentralization First: favor smaller DReps
  if (prefs.includes('strong-decentralization')) {
    const tierScores: Record<string, number> = {
      Small: 95,
      Medium: 80,
      Large: 50,
      Whale: 20,
    };
    breakdown.decentralization = tierScores[drep.sizeTier] || 50;
  }

  // Protocol Security & Stability: high participation + rationale
  if (prefs.includes('protocol-security-first')) {
    const securityScore =
      drep.participationRate * 0.5 + drep.rationaleRate * 0.5;
    breakdown.security = Math.round(securityScore);
  }

  // Innovation & DeFi Growth: high participation, yes votes
  if (prefs.includes('innovation-defi-growth')) {
    const yesRate = votes.length > 0
      ? (votes.filter((v) => v.vote === 'Yes').length / votes.length) * 100
      : 50;
    breakdown.innovation = Math.round(drep.participationRate * 0.6 + yesRate * 0.4);
  }

  // Transparency & Accountability: rationale rate
  if (prefs.includes('responsible-governance')) {
    breakdown.transparency = drep.rationaleRate;
  }

  // Calculate overall alignment (weighted average of active prefs)
  const activeScores: number[] = [];
  if (prefs.includes('treasury-conservative') || prefs.includes('smart-treasury-growth')) {
    activeScores.push(breakdown.treasury);
  }
  if (prefs.includes('strong-decentralization')) {
    activeScores.push(breakdown.decentralization);
  }
  if (prefs.includes('protocol-security-first')) {
    activeScores.push(breakdown.security);
  }
  if (prefs.includes('innovation-defi-growth')) {
    activeScores.push(breakdown.innovation);
  }
  if (prefs.includes('responsible-governance')) {
    activeScores.push(breakdown.transparency);
  }

  breakdown.overall =
    activeScores.length > 0
      ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length)
      : 50;

  return breakdown;
}

/**
 * Calculate overall alignment percentage (0-100)
 */
export function calculateAlignment(
  drep: EnrichedDRep,
  votes: DRepVote[],
  prefs: UserPrefKey[]
): number {
  if (prefs.length === 0) return 50;
  return calculateAlignmentBreakdown(drep, votes, prefs).overall;
}

/**
 * Calculate hybrid score: base_score * 0.6 + alignment * 0.4
 * Only applies hybrid formula when user has preferences set
 */
export function calculateHybridScore(
  baseScore: number,
  alignment: number,
  hasPrefs: boolean
): number {
  if (!hasPrefs) return baseScore;
  return Math.round(baseScore * 0.6 + alignment * 0.4);
}

/**
 * Detect mismatches between DRep votes and user preferences
 * Returns recent votes that conflict with user values
 */
export function detectMismatches(
  drepId: string,
  drepName: string,
  votes: DRepVote[],
  prefs: UserPrefKey[]
): MismatchAlert[] {
  if (prefs.length === 0 || votes.length === 0) return [];

  const alerts: MismatchAlert[] = [];
  const recentVotes = votes
    .sort((a, b) => b.block_time - a.block_time)
    .slice(0, 10);

  for (const vote of recentVotes) {
    const isTreasury = isTreasuryVote(vote);

    // Treasury Conservative conflict: Yes vote on treasury
    if (prefs.includes('treasury-conservative') && isTreasury && vote.vote === 'Yes') {
      alerts.push({
        id: `${drepId}-${vote.vote_tx_hash}`,
        drepId,
        drepName,
        vote: vote.vote,
        proposalTitle: vote.meta_json?.title || 'Treasury Proposal',
        conflictingPref: 'treasury-conservative',
        timestamp: vote.block_time * 1000,
        severity: 'medium',
      });
    }

    // Treasury Growth conflict: No vote on treasury without rationale
    if (
      prefs.includes('smart-treasury-growth') &&
      isTreasury &&
      vote.vote === 'No' &&
      !vote.meta_url &&
      !vote.meta_json?.rationale
    ) {
      alerts.push({
        id: `${drepId}-${vote.vote_tx_hash}`,
        drepId,
        drepName,
        vote: vote.vote,
        proposalTitle: vote.meta_json?.title || 'Treasury Proposal',
        conflictingPref: 'smart-treasury-growth',
        timestamp: vote.block_time * 1000,
        severity: 'low',
      });
    }

    // Transparency conflict: vote without rationale
    if (
      prefs.includes('responsible-governance') &&
      !vote.meta_url &&
      !vote.meta_json?.rationale
    ) {
      alerts.push({
        id: `${drepId}-${vote.vote_tx_hash}`,
        drepId,
        drepName,
        vote: vote.vote,
        proposalTitle: vote.meta_json?.title || 'Governance Proposal',
        conflictingPref: 'responsible-governance',
        timestamp: vote.block_time * 1000,
        severity: 'low',
      });
    }
  }

  return alerts.slice(0, 5);
}

/**
 * Get human-readable preference label
 */
export function getPrefLabel(pref: UserPrefKey): string {
  const labels: Record<UserPrefKey, string> = {
    'treasury-conservative': 'Treasury Conservative',
    'smart-treasury-growth': 'Treasury Growth-Oriented',
    'strong-decentralization': 'Decentralization First',
    'protocol-security-first': 'Protocol Security & Stability',
    'innovation-defi-growth': 'Innovation & DeFi Growth',
    'responsible-governance': 'Transparency & Accountability',
  };
  return labels[pref] || pref;
}

/**
 * Get alignment badge color based on percentage
 */
export function getAlignmentColor(alignment: number): string {
  if (alignment >= 70) return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
  if (alignment >= 50) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
}

/**
 * Generate dummy alignment data for demo/localStorage fallback
 */
export function generateDummyAlignment(drep: EnrichedDRep, prefs: UserPrefKey[]): number {
  if (prefs.length === 0) return 50;

  let score = 50;

  if (prefs.includes('strong-decentralization')) {
    if (drep.sizeTier === 'Small') score += 20;
    else if (drep.sizeTier === 'Medium') score += 10;
    else if (drep.sizeTier === 'Whale') score -= 15;
  }

  if (prefs.includes('responsible-governance')) {
    score += Math.round((drep.rationaleRate - 50) * 0.3);
  }

  if (prefs.includes('protocol-security-first')) {
    score += Math.round((drep.participationRate - 50) * 0.2);
  }

  if (prefs.includes('innovation-defi-growth')) {
    score += Math.round((drep.participationRate - 50) * 0.25);
  }

  return Math.max(0, Math.min(100, score));
}
