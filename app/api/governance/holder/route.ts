/**
 * ADA Holder Governance Dashboard API
 * Returns representation score, active proposals with poll+DRep status,
 * poll history, and re-delegation suggestions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { createClient } from '@/lib/supabase';
import { getDRepById } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalPriority } from '@/utils/proposalPriority';
import { getDRepPrimaryName } from '@/utils/display';

export const dynamic = 'force-dynamic';

function normalizeVote(vote: string): string {
  return vote.charAt(0).toUpperCase() + vote.slice(1).toLowerCase();
}

async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  return session?.walletAddress ?? null;
}

export async function GET(request: NextRequest) {
  const walletAddress = await authenticateRequest(request);
  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const delegatedDrepId = request.nextUrl.searchParams.get('drepId');
  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  try {
    // Parallel fetch: user's poll votes, DRep data, open proposals, DRep votes
    const [pollResult, drepData, proposalsResult, drepVotesResult, userResult] = await Promise.all([
      supabase
        .from('poll_responses')
        .select('proposal_tx_hash, proposal_index, vote, initial_vote, created_at')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false }),
      delegatedDrepId ? getDRepById(delegatedDrepId) : Promise.resolve(null),
      supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, proposal_type, block_time, proposed_epoch, expiration_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch')
        .order('block_time', { ascending: false }),
      delegatedDrepId
        ? supabase
            .from('drep_votes')
            .select('proposal_tx_hash, proposal_index, vote, block_time')
            .eq('drep_id', delegatedDrepId)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('users')
        .select('prefs')
        .eq('wallet_address', walletAddress)
        .single(),
    ]);

    const pollVotes = pollResult.data || [];
    const allProposals = proposalsResult.data || [];
    const drepVotes = drepVotesResult.data || [];

    // Build DRep vote lookup: "txHash-index" → vote
    const drepVoteMap = new Map<string, string>();
    for (const v of drepVotes) {
      drepVoteMap.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v.vote);
    }

    // Build poll vote lookup
    const pollVoteMap = new Map<string, { vote: string; initialVote: string; createdAt: string }>();
    for (const p of pollVotes) {
      pollVoteMap.set(`${p.proposal_tx_hash}-${p.proposal_index}`, {
        vote: p.vote,
        initialVote: p.initial_vote,
        createdAt: p.created_at,
      });
    }

    // Build proposal lookup
    const proposalMap = new Map<string, typeof allProposals[0]>();
    for (const p of allProposals) {
      proposalMap.set(`${p.tx_hash}-${p.proposal_index}`, p);
    }

    // --- Representation Score ---
    const comparisons: {
      proposalTxHash: string;
      proposalIndex: number;
      proposalTitle: string | null;
      userVote: string;
      drepVote: string;
      aligned: boolean;
    }[] = [];

    for (const pv of pollVotes) {
      const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
      const drepVote = drepVoteMap.get(key);
      if (!drepVote) continue;

      const normalizedUserVote = normalizeVote(pv.vote);
      const aligned = normalizedUserVote === drepVote;
      const proposal = proposalMap.get(key);

      comparisons.push({
        proposalTxHash: pv.proposal_tx_hash,
        proposalIndex: pv.proposal_index,
        proposalTitle: proposal?.title || null,
        userVote: normalizedUserVote,
        drepVote,
        aligned,
      });
    }

    const alignedCount = comparisons.filter(c => c.aligned).length;
    const repScore = comparisons.length > 0
      ? Math.round((alignedCount / comparisons.length) * 100)
      : null;

    // --- Delegation Health ---
    let delegationHealth = null;
    if (delegatedDrepId && drepData) {
      const userPrefs: string[] = userResult.data?.prefs?.userPrefs || [];

      const alignmentFields: Record<string, string> = {
        'Treasury Conservative': 'alignmentTreasuryConservative',
        'Treasury Growth-Oriented': 'alignmentTreasuryGrowth',
        'Decentralization First': 'alignmentDecentralization',
        'Protocol Security & Stability': 'alignmentSecurity',
        'Innovation & DeFi Growth': 'alignmentInnovation',
        'Transparency & Accountability': 'alignmentTransparency',
      };

      let alignmentScore: number | null = null;
      if (userPrefs.length > 0) {
        const scores = userPrefs
          .map(pref => {
            const field = alignmentFields[pref];
            return field ? (drepData as unknown as Record<string, unknown>)[field] as number | null : null;
          })
          .filter((s): s is number => s !== null);
        if (scores.length > 0) {
          alignmentScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
      }

      const votedOnOpen = drepVotes.filter(v => {
        const p = proposalMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`);
        return p && !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch;
      }).length;

      const openCount = allProposals.filter(
        p => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch
      ).length;

      delegationHealth = {
        drepId: delegatedDrepId,
        drepName: getDRepPrimaryName(drepData),
        drepScore: drepData.drepScore,
        participationRate: drepData.effectiveParticipation,
        votedOnOpen: votedOnOpen,
        openProposalCount: openCount,
        alignmentScore,
      };
    }

    // --- Active Proposals (open only, with user + DRep status) ---
    const activeProposals = allProposals
      .filter(p => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch)
      .map(p => {
        const key = `${p.tx_hash}-${p.proposal_index}`;
        const pollEntry = pollVoteMap.get(key);
        const drepVote = drepVoteMap.get(key) || null;
        const expirationEpoch = p.expiration_epoch ?? (p.proposed_epoch != null ? p.proposed_epoch + 6 : null);
        const epochsRemaining = expirationEpoch != null ? Math.max(0, expirationEpoch - currentEpoch) : null;

        return {
          txHash: p.tx_hash,
          proposalIndex: p.proposal_index,
          title: p.title,
          proposalType: p.proposal_type,
          priority: getProposalPriority(p.proposal_type),
          epochsRemaining,
          userVote: pollEntry ? normalizeVote(pollEntry.vote) : null,
          drepVote,
        };
      });

    // Sort: needs-your-vote first, then by deadline
    const priorityOrder: Record<string, number> = { critical: 0, important: 1, standard: 2 };
    activeProposals.sort((a, b) => {
      const aVoted = a.userVote ? 1 : 0;
      const bVoted = b.userVote ? 1 : 0;
      if (aVoted !== bVoted) return aVoted - bVoted;
      if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
      return (a.epochsRemaining ?? 999) - (b.epochsRemaining ?? 999);
    });

    // --- Poll History (all user votes with context) ---
    // Get community consensus for each proposal the user voted on
    const pollProposalKeys = pollVotes.map(pv => `${pv.proposal_tx_hash}-${pv.proposal_index}`);
    const uniqueTxHashes = [...new Set(pollVotes.map(pv => pv.proposal_tx_hash))];

    let communityVoteMap = new Map<string, { yes: number; no: number; abstain: number }>();
    if (uniqueTxHashes.length > 0) {
      const { data: communityVotes } = await supabase
        .from('poll_responses')
        .select('proposal_tx_hash, proposal_index, vote')
        .in('proposal_tx_hash', uniqueTxHashes);

      if (communityVotes) {
        for (const cv of communityVotes) {
          const key = `${cv.proposal_tx_hash}-${cv.proposal_index}`;
          if (!pollProposalKeys.includes(key)) continue;
          const entry = communityVoteMap.get(key) || { yes: 0, no: 0, abstain: 0 };
          entry[cv.vote as 'yes' | 'no' | 'abstain']++;
          communityVoteMap.set(key, entry);
        }
      }
    }

    const pollHistory = pollVotes.map(pv => {
      const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
      const proposal = proposalMap.get(key);
      const drepVote = drepVoteMap.get(key) || null;
      const community = communityVoteMap.get(key) || { yes: 0, no: 0, abstain: 0 };

      const maxVote = Math.max(community.yes, community.no, community.abstain);
      let consensus: string | null = null;
      if (maxVote > 0) {
        if (community.yes === maxVote) consensus = 'Yes';
        else if (community.no === maxVote) consensus = 'No';
        else consensus = 'Abstain';
      }

      const normalizedUserVote = normalizeVote(pv.vote);
      const alignedWithDrep = drepVote ? normalizedUserVote === drepVote : null;

      return {
        proposalTxHash: pv.proposal_tx_hash,
        proposalIndex: pv.proposal_index,
        proposalTitle: proposal?.title || null,
        userVote: normalizedUserVote,
        communityConsensus: consensus,
        drepVote,
        alignedWithDrep,
        votedAt: pv.created_at,
      };
    });

    // --- Re-delegation Suggestions (only if representation score < 50%) ---
    let redelegationSuggestions: {
      drepId: string;
      drepName: string | null;
      drepScore: number;
      matchCount: number;
      totalComparisons: number;
      matchRate: number;
    }[] = [];

    if (repScore !== null && repScore < 50 && pollVotes.length >= 3) {
      // Find DReps whose on-chain votes match the user's poll votes
      const userVoteKeys = pollVotes.map(pv => pv.proposal_tx_hash);

      const { data: candidateVotes } = await supabase
        .from('drep_votes')
        .select('drep_id, proposal_tx_hash, proposal_index, vote')
        .in('proposal_tx_hash', userVoteKeys)
        .neq('drep_id', delegatedDrepId || '');

      if (candidateVotes && candidateVotes.length > 0) {
        const drepMatchMap = new Map<string, { matched: number; total: number }>();

        for (const cv of candidateVotes) {
          const key = `${cv.proposal_tx_hash}-${cv.proposal_index}`;
          const pollEntry = pollVoteMap.get(key);
          if (!pollEntry) continue;

          const entry = drepMatchMap.get(cv.drep_id) || { matched: 0, total: 0 };
          entry.total++;
          if (normalizeVote(pollEntry.vote) === cv.vote) entry.matched++;
          drepMatchMap.set(cv.drep_id, entry);
        }

        // Filter to DReps with >= 60% match and at least 2 comparisons
        const candidates = [...drepMatchMap.entries()]
          .filter(([, m]) => m.total >= 2 && (m.matched / m.total) >= 0.6)
          .sort((a, b) => (b[1].matched / b[1].total) - (a[1].matched / a[1].total))
          .slice(0, 5);

        if (candidates.length > 0) {
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
                score: d.score || 0,
              });
            }
          }

          redelegationSuggestions = candidates.map(([drepId, match]) => {
            const info = drepInfoMap.get(drepId);
            return {
              drepId,
              drepName: info?.name || null,
              drepScore: info?.score || 0,
              matchCount: match.matched,
              totalComparisons: match.total,
              matchRate: Math.round((match.matched / match.total) * 100),
            };
          });
        }
      }
    }

    return NextResponse.json({
      delegationHealth,
      representationScore: {
        score: repScore,
        aligned: alignedCount,
        misaligned: comparisons.length - alignedCount,
        total: comparisons.length,
        comparisons,
      },
      activeProposals,
      pollHistory,
      redelegationSuggestions,
      currentEpoch,
    });
  } catch (error) {
    console.error('[Governance Dashboard API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
