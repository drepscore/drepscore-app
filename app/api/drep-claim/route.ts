import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';

/**
 * Auto-claim a DRep profile when an authenticated wallet matches the DRep ID.
 * Called client-side when a DRep visits their own detail page.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionToken, drepId } = await request.json();

    if (!sessionToken || !drepId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const parsed = parseSessionToken(sessionToken);
    if (!parsed || isSessionExpired(parsed)) {
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
      console.error('[DRepClaim] Error:', error);
      return NextResponse.json({ error: 'Failed to claim' }, { status: 500 });
    }

    return NextResponse.json({ claimed: true, drepId });
  } catch (err) {
    console.error('[DRepClaim] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
