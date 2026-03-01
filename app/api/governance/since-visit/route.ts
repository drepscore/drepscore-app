import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

  const since = request.nextUrl.searchParams.get('since');
  const drepId = request.nextUrl.searchParams.get('drepId');

  if (!since) {
    return NextResponse.json({ error: 'Missing since parameter' }, { status: 400 });
  }

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'Invalid since timestamp' }, { status: 400 });
  }

  const sinceBlockTime = Math.floor(sinceDate.getTime() / 1000);
  const supabase = createClient();

  try {
    const [openedResult, closedResult] = await Promise.all([
      supabase.from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .gte('created_at', sinceDate.toISOString()),
      supabase.from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .gte('created_at', sinceDate.toISOString())
        .not('ratified_epoch', 'is', null),
    ]);

    const proposalsOpened = openedResult.count || 0;
    const proposalsClosed = closedResult.count || 0;

    let drepVotesCast = 0;
    let drepScoreChange: number | null = null;

    if (drepId) {
      const [votesResult, latestScoreResult, oldScoreResult] = await Promise.all([
        supabase.from('drep_votes')
          .select('id', { count: 'exact', head: true })
          .eq('drep_id', drepId)
          .gt('block_time', sinceBlockTime),
        supabase.from('drep_score_history')
          .select('score, recorded_at')
          .eq('drep_id', drepId)
          .order('recorded_at', { ascending: false })
          .limit(1),
        supabase.from('drep_score_history')
          .select('score, recorded_at')
          .eq('drep_id', drepId)
          .lte('recorded_at', sinceDate.toISOString())
          .order('recorded_at', { ascending: false })
          .limit(1),
      ]);

      drepVotesCast = votesResult.count || 0;

      const latestScore = latestScoreResult.data?.[0]?.score ?? null;
      const oldScore = oldScoreResult.data?.[0]?.score ?? null;

      if (latestScore !== null && oldScore !== null) {
        drepScoreChange = Math.round((latestScore - oldScore) * 10) / 10;
      }
    }

    return NextResponse.json({
      proposalsOpened,
      proposalsClosed,
      drepVotesCast,
      drepScoreChange,
    });
  } catch (err) {
    console.error('[Since Visit API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
