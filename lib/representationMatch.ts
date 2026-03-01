/**
 * Shared representation matching engine.
 * Compares a user's poll votes against DRep on-chain votes on overlapping proposals.
 */

import { createClient } from '@/lib/supabase';

function normalizeVote(vote: string): string {
  return vote.charAt(0).toUpperCase() + vote.slice(1).toLowerCase();
}

export interface VoteComparison {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  userVote: string;
  drepVote: string;
  agreed: boolean;
}

export interface RepresentationMatchResult {
  score: number | null;
  aligned: number;
  misaligned: number;
  total: number;
  comparisons: VoteComparison[];
}

/**
 * Calculate how well a single DRep represents a user's voting preferences.
 */
export function calculateRepresentationMatch(
  pollVotes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
  drepVotes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
  proposalTitleMap?: Map<string, string | null>
): RepresentationMatchResult {
  const drepVoteMap = new Map<string, string>();
  for (const v of drepVotes) {
    drepVoteMap.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v.vote);
  }

  const comparisons: VoteComparison[] = [];
  for (const pv of pollVotes) {
    const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
    const drepVote = drepVoteMap.get(key);
    if (!drepVote) continue;

    const normalizedUserVote = normalizeVote(pv.vote);
    comparisons.push({
      proposalTxHash: pv.proposal_tx_hash,
      proposalIndex: pv.proposal_index,
      proposalTitle: proposalTitleMap?.get(key) ?? null,
      userVote: normalizedUserVote,
      drepVote,
      agreed: normalizedUserVote === drepVote,
    });
  }

  const aligned = comparisons.filter(c => c.agreed).length;
  return {
    score: comparisons.length > 0 ? Math.round((aligned / comparisons.length) * 100) : null,
    aligned,
    misaligned: comparisons.length - aligned,
    total: comparisons.length,
    comparisons,
  };
}

export interface DRepMatchSummary {
  drepId: string;
  drepName: string | null;
  drepScore: number;
  matchScore: number;
  agreed: number;
  overlapping: number;
}

/**
 * Find the best-matching DReps for a user based on their poll votes.
 * Queries all DRep votes on proposals the user has voted on, then ranks by match rate.
 */
export async function findBestMatchDReps(
  walletAddress: string,
  opts?: {
    excludeDrepId?: string | null;
    minOverlap?: number;
    minMatchRate?: number;
    limit?: number;
  }
): Promise<{
  matches: DRepMatchSummary[];
  currentDRepMatch: RepresentationMatchResult | null;
}> {
  const supabase = createClient();
  const minOverlap = opts?.minOverlap ?? 2;
  const minMatchRate = opts?.minMatchRate ?? 0;
  const limit = opts?.limit ?? 100;

  // Fetch user's poll votes
  const { data: pollVotes } = await supabase
    .from('poll_responses')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('wallet_address', walletAddress);

  if (!pollVotes || pollVotes.length === 0) {
    return { matches: [], currentDRepMatch: null };
  }

  const userVoteKeys = [...new Set(pollVotes.map(pv => pv.proposal_tx_hash))];
  const pollVoteMap = new Map<string, string>();
  for (const pv of pollVotes) {
    pollVoteMap.set(`${pv.proposal_tx_hash}-${pv.proposal_index}`, pv.vote);
  }

  // Fetch all DRep votes on overlapping proposals
  const { data: candidateVotes } = await supabase
    .from('drep_votes')
    .select('drep_id, proposal_tx_hash, proposal_index, vote')
    .in('proposal_tx_hash', userVoteKeys);

  if (!candidateVotes || candidateVotes.length === 0) {
    return { matches: [], currentDRepMatch: null };
  }

  // Aggregate match stats per DRep
  const drepMatchMap = new Map<string, { matched: number; total: number }>();
  for (const cv of candidateVotes) {
    const key = `${cv.proposal_tx_hash}-${cv.proposal_index}`;
    const userVote = pollVoteMap.get(key);
    if (!userVote) continue;

    const entry = drepMatchMap.get(cv.drep_id) || { matched: 0, total: 0 };
    entry.total++;
    if (normalizeVote(userVote) === cv.vote) entry.matched++;
    drepMatchMap.set(cv.drep_id, entry);
  }

  // Calculate current DRep match if specified
  let currentDRepMatch: RepresentationMatchResult | null = null;
  if (opts?.excludeDrepId) {
    const currentStats = drepMatchMap.get(opts.excludeDrepId);
    if (currentStats && currentStats.total > 0) {
      currentDRepMatch = {
        score: Math.round((currentStats.matched / currentStats.total) * 100),
        aligned: currentStats.matched,
        misaligned: currentStats.total - currentStats.matched,
        total: currentStats.total,
        comparisons: [],
      };
    }
  }

  // Filter and sort
  const candidates = [...drepMatchMap.entries()]
    .filter(([id, m]) => {
      if (id === opts?.excludeDrepId) return false;
      if (m.total < minOverlap) return false;
      const rate = m.matched / m.total;
      return rate >= minMatchRate;
    })
    .sort((a, b) => (b[1].matched / b[1].total) - (a[1].matched / a[1].total))
    .slice(0, limit);

  if (candidates.length === 0) {
    return { matches: [], currentDRepMatch };
  }

  // Fetch DRep metadata
  const candidateDrepIds = candidates.map(([id]) => id);
  const { data: drepRows } = await supabase
    .from('dreps')
    .select('id, info, score')
    .in('id', candidateDrepIds);

  const drepInfoMap = new Map<string, { name: string | null; score: number }>();
  if (drepRows) {
    for (const d of drepRows) {
      drepInfoMap.set(d.id, {
        name: (d.info as Record<string, unknown>)?.name as string || null,
        score: Number(d.score) || 0,
      });
    }
  }

  const matches: DRepMatchSummary[] = candidates.map(([drepId, match]) => {
    const info = drepInfoMap.get(drepId);
    return {
      drepId,
      drepName: info?.name || null,
      drepScore: info?.score || 0,
      matchScore: Math.round((match.matched / match.total) * 100),
      agreed: match.matched,
      overlapping: match.total,
    };
  });

  return { matches, currentDRepMatch };
}
