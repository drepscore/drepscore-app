import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const supabase = createClient();

    const { data: history } = await supabase
      .from('drep_score_history')
      .select('score, recorded_at')
      .eq('drep_id', drepId)
      .order('recorded_at', { ascending: false })
      .limit(14);

    if (!history || history.length < 2) {
      return NextResponse.json({ delta: 0 });
    }

    const currentScore = history[0].score;
    const weekAgo = history.length >= 7 ? history[6] : history[history.length - 1];
    const previousScore = weekAgo.score;
    const delta = currentScore - previousScore;

    captureServerEvent('score_change_api_served', {
      drep_id: drepId,
      delta,
      has_significant_change: Math.abs(delta) >= 3,
    });

    return NextResponse.json({
      currentScore,
      previousScore,
      delta,
      date: weekAgo.recorded_at,
    });
  } catch (err) {
    console.error('[Score Change API] Error:', err);
    captureServerEvent('score_change_api_error', { drep_id: drepId, error: String(err) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
