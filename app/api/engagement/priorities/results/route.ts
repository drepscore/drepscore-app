import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { PRIORITY_AREAS } from '@/lib/api/schemas/engagement';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const epochParam = searchParams.get('epoch');
    const epoch = epochParam
      ? parseInt(epochParam, 10)
      : blockTimeToEpoch(Math.floor(Date.now() / 1000));

    if (isNaN(epoch)) {
      return NextResponse.json({ error: 'Invalid epoch' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check for precomputed rankings first
    const { data: precomputed } = await supabase
      .from('citizen_priority_rankings')
      .select('*')
      .eq('epoch', epoch)
      .single();

    if (precomputed) {
      return NextResponse.json({
        rankings: precomputed.rankings,
        totalVoters: precomputed.total_voters,
        epoch,
      });
    }

    // Compute on the fly if no precomputed data
    const { data: signals, error } = await supabase
      .from('citizen_priority_signals')
      .select('ranked_priorities')
      .eq('epoch', epoch);

    if (error) {
      logger.error('Priority signals query error', {
        context: 'engagement/priorities/results',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }

    const rows = signals || [];
    const rankings = computeBordaRankings(rows.map((r) => r.ranked_priorities));

    return NextResponse.json({
      rankings,
      totalVoters: rows.length,
      epoch,
    });
  },
  { auth: 'optional' },
);

/**
 * Borda count ranking: 1st choice gets N points, 2nd gets N-1, etc.
 * Where N = max choices allowed (5).
 */
function computeBordaRankings(
  allRankings: string[][],
): { priority: string; score: number; rank: number; firstChoiceCount: number }[] {
  const maxPoints = 5;
  const scores: Record<string, number> = {};
  const firstChoiceCounts: Record<string, number> = {};

  for (const area of PRIORITY_AREAS) {
    scores[area] = 0;
    firstChoiceCounts[area] = 0;
  }

  for (const ranking of allRankings) {
    for (let i = 0; i < ranking.length; i++) {
      const area = ranking[i];
      scores[area] = (scores[area] || 0) + (maxPoints - i);
      if (i === 0) {
        firstChoiceCounts[area] = (firstChoiceCounts[area] || 0) + 1;
      }
    }
  }

  return Object.entries(scores)
    .map(([priority, score]) => ({
      priority,
      score,
      rank: 0,
      firstChoiceCount: firstChoiceCounts[priority] || 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}
