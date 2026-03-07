import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { CONCERN_FLAG_TYPES } from '@/lib/api/schemas/engagement';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const { searchParams } = new URL(request.url);
    const proposalTxHash = searchParams.get('proposalTxHash');
    const proposalIndexStr = searchParams.get('proposalIndex');

    if (!proposalTxHash || !proposalIndexStr) {
      return NextResponse.json(
        { error: 'proposalTxHash and proposalIndex required' },
        { status: 400 },
      );
    }

    const proposalIndex = parseInt(proposalIndexStr, 10);
    if (isNaN(proposalIndex)) {
      return NextResponse.json({ error: 'proposalIndex must be a number' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: allFlags, error } = await supabase
      .from('citizen_concern_flags')
      .select('flag_type, user_id')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex);

    if (error) {
      logger.error('Concern flags query error', {
        context: 'engagement/concerns/results',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
    }

    const rows = allFlags || [];

    // Aggregate counts per flag type
    const flags: Record<string, number> = {};
    for (const ft of CONCERN_FLAG_TYPES) {
      flags[ft] = 0;
    }
    for (const row of rows) {
      flags[row.flag_type] = (flags[row.flag_type] || 0) + 1;
    }

    // User's own flags
    const userFlags = userId
      ? rows.filter((r) => r.user_id === userId).map((r) => r.flag_type)
      : [];

    return NextResponse.json({
      flags,
      total: rows.length,
      userFlags,
    });
  },
  { auth: 'optional' },
);
