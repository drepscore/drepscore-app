import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { validateSessionToken, revokeSession } from '@/lib/supabaseAuth';

export const POST = withRouteHandler(async (request: NextRequest) => {
  const cookie = request.cookies.get('drepscore_session');
  if (cookie?.value) {
    const session = await validateSessionToken(cookie.value);
    if (session?.jti) {
      await revokeSession(session.jti, session.userId);
    }
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set('drepscore_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
});
