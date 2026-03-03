import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';

/**
 * GET: Check if a DRep is claimed by any user.
 * Returns { claimed: boolean }.
 */
export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('claimed_drep_id', drepId)
      .limit(1);

    if (error) {
      logger.error('Check error', { context: 'drepclaim', error: error?.message });
      return NextResponse.json({ claimed: false });
    }

    return NextResponse.json({ claimed: (data?.length ?? 0) > 0 });
  } catch {
    return NextResponse.json({ claimed: false });
  }
}

/**
 * POST: Auto-claim a DRep profile when an authenticated wallet matches the DRep ID.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionToken, drepId } = await request.json();

    if (!sessionToken || !drepId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const parsed = await validateSessionToken(sessionToken);
    if (!parsed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const walletAddress = parsed.walletAddress;
    const supabase = getSupabaseAdmin();

    // Idempotent upsert: set claimed_drep_id for this wallet
    const { error } = await supabase
      .from('users')
      .update({ claimed_drep_id: drepId })
      .eq('wallet_address', walletAddress);

    if (error) {
      logger.error('Error', { context: 'drepclaim', error: error?.message });
      return NextResponse.json({ error: 'Failed to claim' }, { status: 500 });
    }

    captureServerEvent('drep_claimed', { drep_id: drepId }, walletAddress);
    return NextResponse.json({ claimed: true, drepId });
  } catch (err) {
    logger.error('Error', { context: 'drepclaim', error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
