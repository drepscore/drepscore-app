/**
 * POST /api/user/email — Save email address and send verification email.
 */
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

export const dynamic = 'force-dynamic';

import { sendEmail, generateVerificationUrl } from '@/lib/email';
import { EmailVerificationEmail } from '@/lib/emailTemplates';
import { captureServerEvent } from '@/lib/posthog-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';

function getWallet(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const parsed = parseSessionToken(auth.slice(7));
  if (!parsed || isSessionExpired(parsed)) return null;
  return parsed.walletAddress;
}

export async function POST(request: NextRequest) {
  const wallet = getWallet(request);
  if (!wallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email } = await request.json();
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  await supabase
    .from('users')
    .update({ email, email_verified: false })
    .eq('wallet_address', wallet);

  const verifyUrl = generateVerificationUrl(wallet, email);
  const sent = await sendEmail(
    email,
    'Verify your email — DRepScore',
    React.createElement(EmailVerificationEmail, { verifyUrl }),
  );

  captureServerEvent('email_subscribed', { digest_frequency: 'weekly' }, wallet);

  return NextResponse.json({ ok: true, sent });
}
