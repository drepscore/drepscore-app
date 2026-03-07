import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    if (!userId) {
      return NextResponse.json(null);
    }

    const { searchParams } = new URL(request.url);
    const epochParam = searchParams.get('epoch');
    const epoch = epochParam
      ? parseInt(epochParam, 10)
      : blockTimeToEpoch(Math.floor(Date.now() / 1000));

    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from('citizen_priority_signals')
      .select('ranked_priorities, epoch')
      .eq('user_id', userId)
      .eq('epoch', epoch)
      .single();

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      rankedPriorities: data.ranked_priorities,
      epoch: data.epoch,
    });
  },
  { auth: 'optional' },
);
