/**
 * Reliability pillar (25% of DRep Score).
 * Enhanced from V2 with new Responsiveness sub-component and rebalanced weights.
 * "Can I count on this DRep to keep showing up — and show up quickly?"
 */

import type { VoteData } from './types';

const WEIGHTS = {
  streak: 0.30,
  recency: 0.25,
  gap: 0.20,
  responsiveness: 0.15,
  tenure: 0.10,
};

export interface ReliabilityV3Result {
  score: number;
  streak: number;
  recency: number;
  longestGap: number;
  responsiveness: number;
  tenure: number;
}

/**
 * Compute raw Reliability scores (0-100) for all DReps.
 *
 * @param drepVotes Map of drepId → their votes (with blockTime + proposalBlockTime)
 * @param proposalEpochs Map of epoch → proposal count (epochs that had proposals)
 * @param currentEpoch Current Cardano epoch number
 * @param drepEpochData Map of drepId → { counts, firstEpoch } (epoch vote counts)
 */
export function computeReliability(
  drepVotes: Map<string, VoteData[]>,
  proposalEpochs: Map<number, number>,
  currentEpoch: number,
  drepEpochData: Map<string, { counts: number[]; firstEpoch: number }>,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [drepId, votes] of drepVotes) {
    const epochData = drepEpochData.get(drepId);

    if (!epochData || votes.length === 0) {
      scores.set(drepId, 0);
      continue;
    }

    const result = computeSingleDRepReliability(
      votes,
      epochData.counts,
      epochData.firstEpoch,
      currentEpoch,
      proposalEpochs,
    );

    scores.set(drepId, result.score);
  }

  return scores;
}

function computeSingleDRepReliability(
  votes: VoteData[],
  epochVoteCounts: number[],
  firstEpoch: number,
  currentEpoch: number,
  proposalEpochs: Map<number, number>,
): ReliabilityV3Result {
  const zero: ReliabilityV3Result = {
    score: 0,
    streak: 0,
    recency: 999,
    longestGap: 0,
    responsiveness: 0,
    tenure: 0,
  };

  if (!epochVoteCounts || epochVoteCounts.length === 0) return zero;

  const votedEpochs = new Set<number>();
  for (let i = 0; i < epochVoteCounts.length; i++) {
    if (epochVoteCounts[i] > 0) votedEpochs.add(firstEpoch + i);
  }
  if (votedEpochs.size === 0) return zero;

  const hasProposalData = proposalEpochs.size > 0;
  const epochHadProposals = (e: number) =>
    !hasProposalData || (proposalEpochs.get(e) ?? 0) > 0;

  const lastVotedEpoch = Math.max(...votedEpochs);

  // 1. Active Streak (30%) — consecutive epochs with votes counting backwards
  let streak = 0;
  for (let e = currentEpoch; e >= firstEpoch; e--) {
    if (!epochHadProposals(e)) continue;
    if (votedEpochs.has(e)) {
      streak++;
    } else {
      break;
    }
  }
  const streakScore = Math.min(100, streak * 10);

  // 2. Recency (25%) — exponential decay from last vote
  const recency = Math.max(0, currentEpoch - lastVotedEpoch);
  const recencyScore = Math.round(100 * Math.exp(-recency / 5));

  // 3. Gap Penalty (20%) — longest run of proposal-epochs without a vote
  let longestGap = 0;
  let currentGap = 0;
  for (let e = firstEpoch; e <= currentEpoch; e++) {
    if (!epochHadProposals(e)) continue;
    if (votedEpochs.has(e)) {
      longestGap = Math.max(longestGap, currentGap);
      currentGap = 0;
    } else {
      currentGap++;
    }
  }
  longestGap = Math.max(longestGap, currentGap);
  const gapScore = Math.max(0, 100 - longestGap * 12);

  // 4. Responsiveness (15%) — median days from proposal to vote
  const responsivenessScore = computeResponsiveness(votes);

  // 5. Tenure (10%) — epochs since first vote, diminishing returns
  const tenure = Math.max(0, currentEpoch - firstEpoch);
  const tenureScore = Math.min(100, Math.round(20 + 80 * (1 - Math.exp(-tenure / 30))));

  const combined = Math.round(
    streakScore * WEIGHTS.streak +
      recencyScore * WEIGHTS.recency +
      gapScore * WEIGHTS.gap +
      responsivenessScore * WEIGHTS.responsiveness +
      tenureScore * WEIGHTS.tenure,
  );

  return {
    score: clamp(combined),
    streak,
    recency,
    longestGap,
    responsiveness: responsivenessScore,
    tenure,
  };
}

/**
 * Responsiveness: median days from proposal submission to DRep vote.
 * Score: 100 * exp(-median_days / 14)
 * Within 1 day ≈ 93, within 7 days ≈ 61, within 30 days ≈ 12
 */
function computeResponsiveness(votes: VoteData[]): number {
  const deltas: number[] = [];

  for (const v of votes) {
    if (v.proposalBlockTime > 0 && v.blockTime > v.proposalBlockTime) {
      const daysToVote = (v.blockTime - v.proposalBlockTime) / 86400;
      deltas.push(daysToVote);
    }
  }

  if (deltas.length === 0) return 50; // no data, neutral score

  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)];

  return Math.round(100 * Math.exp(-median / 14));
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
