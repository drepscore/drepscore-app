/**
 * Effective Participation pillar (25% of DRep Score).
 * Importance-weighted participation with close-margin bonus and temporal decay.
 */

import {
  DECAY_LAMBDA,
  type VoteData,
  type ProposalScoringContext,
  type ProposalVotingSummary,
} from './types';

const CLOSE_MARGIN_THRESHOLD = 0.20;
const CLOSE_MARGIN_MULTIPLIER = 1.5;

/**
 * Compute raw Effective Participation scores (0-100) for all DReps.
 *
 * @param drepVotes Map of drepId → their votes
 * @param allProposals All proposals with scoring context (importance weights)
 * @param votingSummaries Map of proposalKey → voting power summary (for margin)
 * @param nowSeconds Current unix timestamp
 */
export function computeEffectiveParticipation(
  drepVotes: Map<string, VoteData[]>,
  allProposals: Map<string, ProposalScoringContext>,
  votingSummaries: Map<string, ProposalVotingSummary>,
  nowSeconds: number,
): Map<string, number> {
  const scores = new Map<string, number>();

  // Pre-compute total weighted proposal pool (denominator)
  const totalWeightedPool = computeTotalWeightedPool(allProposals, votingSummaries, nowSeconds);

  if (totalWeightedPool === 0) {
    for (const drepId of drepVotes.keys()) scores.set(drepId, 0);
    return scores;
  }

  for (const [drepId, votes] of drepVotes) {
    if (votes.length === 0) {
      scores.set(drepId, 0);
      continue;
    }

    let weightedVoted = 0;

    for (const v of votes) {
      const proposal = allProposals.get(v.proposalKey);
      if (!proposal) continue;

      const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
      const decay = Math.exp(-DECAY_LAMBDA * ageDays);
      let weight = proposal.importanceWeight * decay;

      // Close-margin bonus: if the margin was tight, this vote mattered more
      const summary = votingSummaries.get(v.proposalKey);
      if (summary) {
        const margin = computeMargin(summary);
        if (margin < CLOSE_MARGIN_THRESHOLD) {
          weight *= CLOSE_MARGIN_MULTIPLIER;
        }
      }

      weightedVoted += weight;
    }

    const raw = Math.min(100, (weightedVoted / totalWeightedPool) * 100);
    scores.set(drepId, Math.round(raw));
  }

  return scores;
}

/**
 * Total weighted pool: sum of importance weights (with decay and margin bonus)
 * for all proposals. This is the "perfect participation" denominator.
 */
function computeTotalWeightedPool(
  allProposals: Map<string, ProposalScoringContext>,
  votingSummaries: Map<string, ProposalVotingSummary>,
  nowSeconds: number,
): number {
  let total = 0;

  for (const [key, proposal] of allProposals) {
    const ageDays = Math.max(0, (nowSeconds - proposal.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    let weight = proposal.importanceWeight * decay;

    const summary = votingSummaries.get(key);
    if (summary) {
      const margin = computeMargin(summary);
      if (margin < CLOSE_MARGIN_THRESHOLD) {
        weight *= CLOSE_MARGIN_MULTIPLIER;
      }
    }

    total += weight;
  }

  return total;
}

/**
 * Compute vote margin from proposal voting summary.
 * margin = |yes_power - no_power| / (yes_power + no_power + abstain_power)
 * Lower margin = closer call = more important to participate.
 */
function computeMargin(summary: ProposalVotingSummary): number {
  const total =
    summary.drepYesVotePower + summary.drepNoVotePower + summary.drepAbstainVotePower;
  if (total === 0) return 1; // no data, skip bonus
  return Math.abs(summary.drepYesVotePower - summary.drepNoVotePower) / total;
}

/**
 * Extended importance weight with continuous treasury scaling.
 * Base tiers: Critical (3x), Important (2x), Standard (1x).
 * Treasury proposals get additional log-scaled weight based on withdrawal amount.
 */
export function getExtendedImportanceWeight(
  proposalType: string,
  treasuryTier: string | null,
  withdrawalAmountAda: number | null,
): number {
  const CRITICAL_TYPES = [
    'HardForkInitiation',
    'NoConfidence',
    'NewCommittee',
    'NewConstitutionalCommittee',
    'NewConstitution',
    'UpdateConstitution',
  ];

  let base: number;
  if (CRITICAL_TYPES.includes(proposalType)) {
    base = 3;
  } else if (proposalType === 'ParameterChange') {
    base = 2;
  } else if (
    proposalType === 'TreasuryWithdrawals' &&
    (treasuryTier === 'significant' || treasuryTier === 'major')
  ) {
    base = 2;
  } else {
    base = 1;
  }

  // Continuous treasury scaling for treasury withdrawals
  if (proposalType === 'TreasuryWithdrawals' && withdrawalAmountAda && withdrawalAmountAda > 0) {
    const treasuryMultiplier = 1 + Math.log10(withdrawalAmountAda + 1) / 7;
    return base * Math.min(2.4, treasuryMultiplier);
  }

  return base;
}
