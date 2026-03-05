import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/pools/:poolId/delegator-trends
 * Returns delegator count trend for a pool.
 * Uses spo_score_snapshots when available; falls back to current pools.delegator_count.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const poolId = request.nextUrl.pathname.split('/pools/')[1]?.split('/')[0];
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });

  const supabase = createClient();

  const { data: pool } = await supabase
    .from('pools')
    .select('delegator_count')
    .eq('pool_id', poolId)
    .single();

  const current = pool?.delegator_count ?? 0;

  const { data: snapshots } = await supabase
    .from('spo_score_snapshots')
    .select('epoch_no, governance_score')
    .eq('pool_id', poolId)
    .order('epoch_no', { ascending: false })
    .limit(10);

  return NextResponse.json(
    {
      current,
      history: snapshots ?? [],
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
  );
});
