import { NextRequest, NextResponse } from 'next/server';
import { checkSignature, DataSignature } from '@meshsdk/core';
import { createSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyNonce } from '@/lib/nonce';

export const runtime = 'nodejs';

interface AuthRequest {
  address: string;
  nonce: string;
  nonceHex: string;
  nonceSignature: string;
  signature: string;
  key: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AuthRequest = await request.json();
    const { address, nonce, nonceHex, nonceSignature, signature, key } = body;

    // #region agent log
    console.log('[DEBUG ce4185] Auth request received:', { address: address?.substring(0, 20), nonce: nonce?.substring(0, 30), nonceHex: nonceHex?.substring(0, 30), sigLen: signature?.length, keyLen: key?.length });
    // #endregion

    if (!address || !nonce || !nonceHex || !nonceSignature || !signature || !key) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const nonceValid = await verifyNonce(nonce, nonceSignature);
    if (!nonceValid) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    // #region agent log
    console.log('[DEBUG ce4185] Nonce verified, calling checkSignature with hex nonce:', { addressPrefix: address.substring(0, 10), nonceHexPrefix: nonceHex.substring(0, 20) });
    // #endregion

    const dataSignature: DataSignature = { signature, key };
    
    let isValid = false;
    try {
      isValid = await checkSignature(nonceHex, dataSignature, address);
      // #region agent log
      console.log('[DEBUG ce4185] checkSignature result:', isValid);
      // #endregion
    } catch (sigError) {
      // #region agent log
      console.error('[DEBUG ce4185] checkSignature threw error:', sigError);
      // #endregion
      return NextResponse.json({ error: String(sigError) }, { status: 401 });
    }
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          wallet_address: address,
          last_active: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' }
      );

    if (upsertError) {
      console.error('User upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    const sessionToken = await createSessionToken(address);

    return NextResponse.json({
      sessionToken,
      address,
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
