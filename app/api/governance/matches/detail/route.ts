import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { calculateRepresentationMatch } from '@/lib/representationMatch';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const drepId = request.nextUrl.searchParams.get('drepId');
    if (!drepId) {
      return NextResponse.json({ error: 'drepId required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: pollVotes } = await supabase
      .from('poll_responses')
      .select('proposal_tx_hash, proposal_index, vote')
      .eq('user_id', userId!);

    if (!pollVotes || pollVotes.length === 0) {
      return NextResponse.json({ comparisons: [], agreed: 0, total: 0, matchScore: 0 });
    }

    const txHashes = [...new Set(pollVotes.map((pv) => pv.proposal_tx_hash))];

    const [{ data: drepVotes }, { data: proposals }] = await Promise.all([
      supabase
        .from('drep_votes')
        .select('proposal_tx_hash, proposal_index, vote')
        .eq('drep_id', drepId)
        .in('proposal_tx_hash', txHashes),
      supabase.from('proposals').select('tx_hash, proposal_index, title').in('tx_hash', txHashes),
    ]);

    const titleMap = new Map<string, string | null>();
    for (const p of proposals ?? []) {
      titleMap.set(`${p.tx_hash}-${p.proposal_index}`, p.title);
    }

    const result = calculateRepresentationMatch(pollVotes, drepVotes ?? [], titleMap);

    captureServerEvent(
      'matches_detail_api_served',
      {
        drep_id: drepId,
        comparisons_count: result.comparisons.length,
        match_score: result.score,
      },
      wallet!,
    );

    return NextResponse.json({
      matchScore: result.score ?? 0,
      agreed: result.aligned,
      total: result.total,
      comparisons: result.comparisons.map((c) => ({
        proposalTitle: c.proposalTitle || `Proposal ${c.proposalTxHash.slice(0, 8)}...`,
        userVote: c.userVote,
        drepVote: c.drepVote,
        agreed: c.agreed,
      })),
    });
  },
  { auth: 'required' },
);
