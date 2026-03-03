import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const drepId = request.nextUrl.searchParams.get('drepId');
    const proposalTxHash = request.nextUrl.searchParams.get('proposalTxHash');
    const proposalIndex = request.nextUrl.searchParams.get('proposalIndex');

    const result: Record<string, number> = {};

    if (drepId) {
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count } = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('drep_id', drepId)
        .gte('viewed_at', oneWeekAgo);
      result.weeklyViews = count ?? 0;
    }

    if (proposalTxHash && proposalIndex) {
      const { count } = await supabase
        .from('poll_responses')
        .select('id', { count: 'exact', head: true })
        .eq('proposal_tx_hash', proposalTxHash)
        .eq('proposal_index', parseInt(proposalIndex, 10));
      result.pollResponses = count ?? 0;
    }

    // Active governance participants this epoch
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: activeUsers } = await supabase
      .from('users')
      .select('wallet_address', { count: 'exact', head: true })
      .gte('last_active', oneWeekAgo);
    result.activeParticipants = activeUsers ?? 0;

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    });
  } catch (error) {
    logger.error('Social proof API error', { context: 'social-proof', error: error });
    return NextResponse.json({ error: 'Failed to fetch social proof' }, { status: 500 });
  }
}
