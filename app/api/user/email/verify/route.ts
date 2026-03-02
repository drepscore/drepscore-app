/**
 * GET /api/user/email/verify?token=... — Verify email address.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { parseVerificationToken } from '@/lib/email';
import { captureServerEvent } from '@/lib/posthog-server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new NextResponse('Missing token', { status: 400 });
  }

  const parsed = parseVerificationToken(token);
  if (!parsed) {
    return new NextResponse('Invalid or expired token', { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .update({ email_verified: true })
    .eq('wallet_address', parsed.walletAddress)
    .eq('email', parsed.email);

  if (error) {
    return new NextResponse('Verification failed', { status: 500 });
  }

  captureServerEvent('email_verified', {}, parsed.walletAddress);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io';
  return NextResponse.redirect(`${baseUrl}/profile?email_verified=true`);
}
