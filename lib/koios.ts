/**
 * DRep Enrichment and Scoring
 * Computes rolled-up DRep Score (0-100) as primary metric.
 * Philosophy: Encourage decentralization + quality over raw voting power.
 */

import {
  fetchAllDReps,
  fetchDRepsWithDetails,
  fetchDRepVotes,
  checkKoiosHealth,
  parseMetadataFields,
} from '@/utils/koios';
import {
  calculateParticipationRate,
  calculateDecentralizationScore,
  lovelaceToAda,
} from '@/utils/scoring';
import { isWellDocumented } from '@/utils/documentation';
import { DRep } from '@/types/drep';

// ---------------------------------------------------------------------------
// Weighting Philosophy
// ---------------------------------------------------------------------------
// We prioritize decentralization (40%) and quality signals (participation 25%,
// rationale 25%) over raw influence (10%). This encourages:
// - Active, thoughtful DReps who vote and explain
// - Balanced power distribution (not whale-dominated)
// - Governance quality over sheer stake size
// ---------------------------------------------------------------------------

/** Weights for DRep Score components (each 0-1, should sum to 1) */
export interface DRepWeights {
  participation: number; // 0-1
  rationale: number;
  decentralization: number;
  influence: number;
}

/** Default: decentralization + quality over raw size */
export const DEFAULT_WEIGHTS: DRepWeights = {
  participation: 0.25,
  rationale: 0.25,
  decentralization: 0.4,
  influence: 0.1,
};

/** DRep with computed drepScore (0-100) */
export interface EnrichedDRep extends DRep {
  drepScore: number;
}

/**
 * Compute percentile rank of a value within an array (0-100).
 * Rank = (count of values strictly less than v) / n * 100.
 */
function percentileRank(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const countBelow = sortedValues.filter((v) => v < value).length;
  return (countBelow / sortedValues.length) * 100;
}

/**
 * Calculate rolled-up DRep Score (0-100).
 * Default missing metrics to 0 to penalize inactive/unknown DReps and ensure full table coverage.
 * Every DRep gets a score (even if low); never returns undefined/NaN.
 *
 * @param drep - DRep with participationRate, rationaleRate, decentralizationScore, votingPower
 * @param influenceScore - Percentile rank of voting_power (0-100)
 */
export function calculateDRepScore(
  drep: Pick<
    DRep,
    'participationRate' | 'rationaleRate' | 'decentralizationScore' | 'votingPower'
  >,
  influenceScore: number,
  weights: DRepWeights = DEFAULT_WEIGHTS
): number {
  // Safely default missing values to 0 to penalize inactive/unknown DReps
  const participation = drep.participationRate ?? 0;
  const rationale = drep.rationaleRate ?? 0;
  const decentralization = drep.decentralizationScore ?? 0;
  const influence = Number(influenceScore) ?? 0;

  // Quality component (0-1): participation + rationale + decentralization
  const quality =
    (participation / 100) * weights.participation +
    (rationale / 100) * weights.rationale +
    (decentralization / 100) * weights.decentralization;

  // Combined score: quality weighted by (1 - influence) + influence percentile
  const raw =
    quality * (1 - weights.influence) + (influence / 100) * weights.influence;
  const score = Math.round(raw * 100);

  // Always return 0-100 integer; never undefined/NaN
  return Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
}

/** Batch size for Koios API (drep_info/drep_metadata limit) */
const BATCH_SIZE = 50;

/** Max concurrent vote fetches to avoid overwhelming the API */
const VOTE_CONCURRENCY = 5;

/**
 * Fetch votes for multiple DReps with limited concurrency
 */
async function fetchVotesBatched(
  drepIds: string[]
): Promise<Record<string, Awaited<ReturnType<typeof fetchDRepVotes>>>> {
  const votesMap: Record<string, Awaited<ReturnType<typeof fetchDRepVotes>>> = {};
  for (let i = 0; i < drepIds.length; i += VOTE_CONCURRENCY) {
    const chunk = drepIds.slice(i, i + VOTE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (id) => {
        try {
          const votes = await fetchDRepVotes(id);
          return { id, votes };
        } catch (error) {
          console.error(`[DRepScore] Failed to fetch votes for ${id}:`, error);
          return { id, votes: [] };
        }
      })
    );
    for (const { id, votes } of results) {
      votesMap[id] = votes;
    }
  }
  return votesMap;
}

/**
 * Fetch enriched DReps with drepScore, sorted by score DESC then voting_power DESC.
 * Loads ALL registered DReps in batches (no limit).
 * @param wellDocumentedOnly - If true, filter to well-documented DReps only (default view)
 */
export async function getEnrichedDReps(
  wellDocumentedOnly: boolean = true
): Promise<{
  dreps: EnrichedDRep[];
  allDReps: EnrichedDRep[];
  error: boolean;
  totalAvailable: number;
}> {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    if (isDev) {
      console.log(`[DRepScore] getEnrichedDReps(wellDocumentedOnly=${wellDocumentedOnly}) - loading ALL DReps in batches`);
    }

    const isHealthy = await checkKoiosHealth();
    if (!isHealthy) {
      console.error('[DRepScore] Koios API health check failed');
      return { dreps: [], allDReps: [], error: true, totalAvailable: 0 };
    }

    const drepList = await fetchAllDReps();
    if (!drepList || drepList.length === 0) {
      if (isDev) console.warn('[DRepScore] No DReps found');
      return { dreps: [], allDReps: [], error: false, totalAvailable: 0 };
    }

    const registeredDReps = drepList.filter((d) => d.registered);
    const totalAvailable = registeredDReps.length;
    const allDrepIds = registeredDReps.map((d) => d.drep_id);

    if (isDev) {
      console.log(`[DRepScore] Loading ALL ${totalAvailable} DReps in batches of ${BATCH_SIZE}...`);
    }

    const allBaseDreps: DRep[] = [];
    let maxVoteCount = 1;

    for (let offset = 0; offset < allDrepIds.length; offset += BATCH_SIZE) {
      const batchIds = allDrepIds.slice(offset, offset + BATCH_SIZE);
      const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allDrepIds.length / BATCH_SIZE);

      if (isDev) {
        console.log(`[DRepScore] Batch ${batchNum}/${totalBatches}: fetching ${batchIds.length} DReps...`);
      }

      const { info, metadata } = await fetchDRepsWithDetails(batchIds);
      const sortedInfo = [...info].sort((a, b) => {
        const aPower = parseInt(a.amount || '0');
        const bPower = parseInt(b.amount || '0');
        return bPower - aPower;
      });

      const votesMap = await fetchVotesBatched(sortedInfo.map((i) => i.drep_id));

      const batchVoteCounts = Object.values(votesMap).map((v) => v.length);
      maxVoteCount = Math.max(maxVoteCount, ...batchVoteCounts, 1);
      const totalProposals = maxVoteCount; // Global max for consistent participation rate

      const batchDreps: DRep[] = sortedInfo.map((drepInfo) => {
        const drepMetadata = metadata.find((m) => m.drep_id === drepInfo.drep_id);
        const votes = votesMap[drepInfo.drep_id] || [];

        const yesVotes = votes.filter((v) => v.vote === 'Yes').length;
        const noVotes = votes.filter((v) => v.vote === 'No').length;
        const abstainVotes = votes.filter((v) => v.vote === 'Abstain').length;

        const votesWithRationale = votes.filter(
          (v) => v.meta_url !== null || v.meta_json?.rationale != null
        ).length;

        const { name, ticker, description } = parseMetadataFields(drepMetadata);
        const votingPower = lovelaceToAda(drepInfo.amount || '0');

        const participationRate = calculateParticipationRate(votes.length, totalProposals);
        const rationaleRate =
          votes.length > 0 ? Math.round((votesWithRationale / votes.length) * 100) : 0;
        const decentralizationScore =
          calculateDecentralizationScore(
            participationRate,
            rationaleRate,
            votingPower,
            yesVotes,
            noVotes,
            abstainVotes
          ) ?? 0; // Stub to 0 if missing; penalize inactive/unknown DReps for full table coverage

        return {
          drepId: drepInfo.drep_id,
          drepHash: drepInfo.drep_hash,
          handle: null,
          name,
          ticker,
          description,
          votingPower,
          votingPowerLovelace: drepInfo.amount || '0',
          participationRate,
          rationaleRate,
          decentralizationScore,
          delegatorCount: drepInfo.delegators || 0,
          totalVotes: votes.length,
          yesVotes,
          noVotes,
          abstainVotes,
          isActive: drepInfo.registered && drepInfo.amount !== '0',
          anchorUrl: drepInfo.anchor_url,
          metadata: drepMetadata?.meta_json?.body || null,
        };
      });

      allBaseDreps.push(...batchDreps);
    }

    // Recompute participation/decentralization with global totalProposals for consistency
    const globalTotalProposals = Math.max(
      ...allBaseDreps.map((d) => d.totalVotes),
      1
    );
    for (const d of allBaseDreps) {
      d.participationRate = calculateParticipationRate(
        d.totalVotes,
        globalTotalProposals
      );
      d.decentralizationScore =
        calculateDecentralizationScore(
          d.participationRate,
          d.rationaleRate,
          d.votingPower,
          d.yesVotes,
          d.noVotes,
          d.abstainVotes
        ) ?? 0;
    }

    const votingPowers = allBaseDreps.map((d) => d.votingPower ?? 0);

    // Ensure EVERY DRep gets a drepScore (0-100); percentile across ALL loaded DReps
    const enriched: EnrichedDRep[] = allBaseDreps.map((drep) => {
      const influenceScore = percentileRank(drep.votingPower ?? 0, votingPowers);
      const drepScore = calculateDRepScore(drep, influenceScore, DEFAULT_WEIGHTS);

      return { ...drep, drepScore };
    });

    const sorted = [...enriched].sort((a, b) => {
      if (a.drepScore !== b.drepScore) return b.drepScore - a.drepScore;
      return b.votingPower - a.votingPower;
    });

    const wellDocumentedDReps = sorted.filter(
      (d) => isWellDocumented(d)
    );

    const drepsToReturn = wellDocumentedOnly ? wellDocumentedDReps : sorted;

    if (isDev) {
      console.log(`[DRepScore] Loaded ${sorted.length} DReps with drepScore`);
      console.log(`[DRepScore] Well documented: ${wellDocumentedDReps.length}/${sorted.length}`);
    }

    return {
      dreps: drepsToReturn,
      allDReps: sorted,
      error: false,
      totalAvailable,
    };
  } catch (error) {
    console.error('[DRepScore] Error in getEnrichedDReps:', error);
    return { dreps: [], allDReps: [], error: true, totalAvailable: 0 };
  }
}
