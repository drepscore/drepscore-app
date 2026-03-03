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
import { requireAuth } from '@/lib/supabaseAuth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const wallet = auth.wallet;

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
