import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ActivityEvent {
  type: 'vote' | 'rationale' | 'proposal';
  drepId: string;
  drepName: string | null;
  detail: string | null;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number; // unix seconds
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '30', 10),
      50
    );
    const supabase = createClient();
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 604800;

    const [votesResult, rationalesResult, proposalsResult] = await Promise.all([
      supabase
        .from('drep_votes')
        .select('drep_id, vote, block_time, proposal_tx_hash')
        .gt('block_time', oneWeekAgo)
        .order('block_time', { ascending: false })
        .limit(limit),

      supabase
        .from('vote_rationales')
        .select('drep_id, fetched_at')
        .not('rationale_text', 'is', null)
        .order('fetched_at', { ascending: false })
        .limit(Math.ceil(limit / 3)),

      supabase
        .from('proposals')
        .select('tx_hash, title, created_at, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch')
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / 3)),
    ]);

    const votes = votesResult.data || [];
    const rationales = rationalesResult.data || [];
    const proposals = proposalsResult.data || [];

    // Fetch DRep names for referenced drep_ids
    const drepIds = new Set<string>();
    for (const v of votes) drepIds.add(v.drep_id);
    for (const r of rationales) drepIds.add(r.drep_id);

    const drepIdsArr = [...drepIds].slice(0, 100);
    const drepsResult = drepIdsArr.length > 0
      ? await supabase
          .from('dreps')
          .select('id, info')
          .in('id', drepIdsArr)
      : { data: [] };

    const nameMap = new Map<string, string>();
    for (const d of drepsResult.data || []) {
      nameMap.set(d.id, d.info?.name || d.info?.ticker || d.info?.handle || null);
    }

    // Fetch proposal titles for referenced votes
    const proposalHashes = new Set(votes.map((v: any) => v.proposal_tx_hash));
    const proposalTitlesResult = proposalHashes.size > 0
      ? await supabase
          .from('proposals')
          .select('tx_hash, title')
          .in('tx_hash', [...proposalHashes].slice(0, 50))
      : { data: [] };

    const titleMap = new Map<string, string>();
    for (const p of proposalTitlesResult.data || []) {
      titleMap.set(p.tx_hash, p.title);
    }

    const events: ActivityEvent[] = [];

    for (const v of votes) {
      events.push({
        type: 'vote',
        drepId: v.drep_id,
        drepName: nameMap.get(v.drep_id) || null,
        detail: titleMap.get(v.proposal_tx_hash) || null,
        vote: v.vote as 'Yes' | 'No' | 'Abstain',
        timestamp: v.block_time,
      });
    }

    for (const r of rationales) {
      events.push({
        type: 'rationale',
        drepId: r.drep_id,
        drepName: nameMap.get(r.drep_id) || null,
        detail: null,
        timestamp: r.fetched_at ? Math.floor(new Date(r.fetched_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
      });
    }

    const recentProposals = proposals.filter(
      (p: any) => p.created_at && new Date(p.created_at).getTime() > Date.now() - 7 * 86400000
    );
    for (const p of recentProposals) {
      events.push({
        type: 'proposal',
        drepId: '',
        drepName: null,
        detail: p.title,
        timestamp: Math.floor(new Date(p.created_at).getTime() / 1000),
      });
    }

    events.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json(events.slice(0, limit), {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
