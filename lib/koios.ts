/**
 * DRep Enrichment and Scoring
 * Computes rolled-up DRep Score (0-100) as primary metric.
 * Philosophy: Objective accountability - do they show up, explain, and stay engaged?
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
  calculateDeliberationModifier,
  calculateConsistency,
  calculateEffectiveParticipation,
  lovelaceToAda,
  getSizeTier,
} from '@/utils/scoring';
import { isWellDocumented } from '@/utils/documentation';
import { DRep } from '@/types/drep';

// ---------------------------------------------------------------------------
// Weighting Philosophy (V2)
// ---------------------------------------------------------------------------
// DRep Score is purely objective - measures accountability:
// - Effective Participation (45%): Do they show up? Penalized for rubber-stamping.
// - Rationale (35%): Do they explain their votes?
// - Consistency (20%): Do they stay engaged over time?
// ---------------------------------------------------------------------------

/** Weights for DRep Score components (each 0-1, should sum to 1) */
export interface DRepWeights {
  effectiveParticipation: number;
  rationale: number;
  consistency: number;
}

/** Default: accountability-focused weights */
export const DEFAULT_WEIGHTS: DRepWeights = {
  effectiveParticipation: 0.45,
  rationale: 0.35,
  consistency: 0.20,
};

/** DRep with computed drepScore (0-100) */
export interface EnrichedDRep extends DRep {
  drepScore: number;
}

/**
 * Calculate rolled-up DRep Score (0-100).
 * Formula: Effective Participation (45%) + Rationale (35%) + Consistency (20%)
 * 
 * Effective Participation = participationRate * deliberationModifier
 * This penalizes rubber-stamping (voting >90% one direction).
 *
 * @param drep - DRep with effectiveParticipation, rationaleRate, consistencyScore
 */
export function calculateDRepScore(
  drep: Pick<
    DRep,
    'effectiveParticipation' | 'rationaleRate' | 'consistencyScore'
  >,
  weights: DRepWeights = DEFAULT_WEIGHTS
): number {
  const effectiveParticipation = drep.effectiveParticipation ?? 0;
  const rationale = drep.rationaleRate ?? 0;
  const consistency = drep.consistencyScore ?? 0;

  const raw =
    (effectiveParticipation / 100) * weights.effectiveParticipation +
    (rationale / 100) * weights.rationale +
    (consistency / 100) * weights.consistency;

  const score = Math.round(raw * 100);

  return Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
}

/** Batch size for Koios API (drep_info/drep_metadata limit) */
const BATCH_SIZE = 50;

/**
 * Compute vote counts per epoch from vote array
 * Groups votes by epoch_no and returns array of counts
 */
function computeEpochVoteCounts(votes: Awaited<ReturnType<typeof fetchDRepVotes>>): number[] {
  if (!votes || votes.length === 0) return [];
  
  const epochCounts: Record<number, number> = {};
  let minEpoch = Infinity;
  let maxEpoch = -Infinity;
  
  for (const vote of votes) {
    const epoch = vote.epoch_no;
    if (epoch !== undefined && epoch !== null) {
      epochCounts[epoch] = (epochCounts[epoch] || 0) + 1;
      minEpoch = Math.min(minEpoch, epoch);
      maxEpoch = Math.max(maxEpoch, epoch);
    }
  }
  
  if (minEpoch === Infinity) return [];
  
  const counts: number[] = [];
  for (let e = minEpoch; e <= maxEpoch; e++) {
    counts.push(epochCounts[e] || 0);
  }
  
  return counts;
}

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
        
        const deliberationModifier = calculateDeliberationModifier(yesVotes, noVotes, abstainVotes);
        const effectiveParticipation = calculateEffectiveParticipation(participationRate, deliberationModifier);
        
        const epochVoteCounts = computeEpochVoteCounts(votes);
        const consistencyScore = calculateConsistency(epochVoteCounts);

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
          consistencyScore,
          deliberationModifier,
          effectiveParticipation,
          sizeTier: getSizeTier(votingPower),
          delegatorCount: drepInfo.delegators || 0,
          totalVotes: votes.length,
          yesVotes,
          noVotes,
          abstainVotes,
          isActive: drepInfo.registered && drepInfo.amount !== '0',
          anchorUrl: drepInfo.anchor_url,
          metadata: drepMetadata?.meta_json?.body || null,
          epochVoteCounts,
        };
      });

      allBaseDreps.push(...batchDreps);
    }

    const globalTotalProposals = Math.max(
      ...allBaseDreps.map((d) => d.totalVotes),
      1
    );
    for (const d of allBaseDreps) {
      d.participationRate = calculateParticipationRate(
        d.totalVotes,
        globalTotalProposals
      );
      d.effectiveParticipation = calculateEffectiveParticipation(
        d.participationRate,
        d.deliberationModifier
      );
      d.consistencyScore = calculateConsistency(d.epochVoteCounts || []);
    }

    // Ensure EVERY DRep gets a drepScore (0-100)
    const enriched: EnrichedDRep[] = allBaseDreps.map((drep) => {
      const drepScore = calculateDRepScore(drep, DEFAULT_WEIGHTS);

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
