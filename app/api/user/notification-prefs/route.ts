import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const wallet = auth.wallet;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('notification_preferences')
    .select('channel, event_type, enabled')
    .eq('user_wallet', wallet);

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const wallet = auth.wallet;

  const { channel, eventType, enabled } = await request.json();
  if (!channel || !eventType || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_wallet: wallet,
      channel,
      event_type: eventType,
      enabled,
    },
    { onConflict: 'user_wallet,channel,event_type' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  captureServerEvent(
    'notification_pref_toggled',
    { channel, event_type: eventType, enabled },
    wallet,
  );
  return NextResponse.json({ ok: true });
}
