import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();

    const { data: votes, error } = await supabase
      .from('spo_votes')
      .select('pool_id, vote');

    if (error) {
      console.error('[governance/pools] Supabase error:', error);
      return NextResponse.json({ pools: [] });
    }

    if (!votes?.length) {
      return NextResponse.json({ pools: [] });
    }

    const poolMap = new Map<string, { yes: number; no: number; abstain: number }>();
    for (const v of votes) {
      const existing = poolMap.get(v.pool_id) || { yes: 0, no: 0, abstain: 0 };
      if (v.vote === 'Yes') existing.yes++;
      else if (v.vote === 'No') existing.no++;
      else existing.abstain++;
      poolMap.set(v.pool_id, existing);
    }

    const pools = Array.from(poolMap.entries())
      .map(([poolId, counts]) => ({
        poolId,
        voteCount: counts.yes + counts.no + counts.abstain,
        yesCount: counts.yes,
        noCount: counts.no,
        abstainCount: counts.abstain,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    return NextResponse.json(
      { pools },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('[governance/pools] Error:', error);
    return NextResponse.json({ pools: [] }, { status: 500 });
  }
}
