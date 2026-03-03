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
    .from('user_channels')
    .select('channel, channel_identifier, config, connected_at')
    .eq('user_wallet', wallet);

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const wallet = auth.wallet;

  const { channel, channelIdentifier, config } = await request.json();
  if (!channel || !channelIdentifier) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('user_channels').upsert(
    {
      user_wallet: wallet,
      channel,
      channel_identifier: channelIdentifier,
      config: config || {},
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_wallet,channel' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  captureServerEvent('notification_channel_connected', { channel }, wallet);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const wallet = auth.wallet;

  const { channel } = await request.json();
  if (!channel) return NextResponse.json({ error: 'Missing channel' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  await supabase.from('user_channels').delete().eq('user_wallet', wallet).eq('channel', channel);

  captureServerEvent('notification_channel_disconnected', { channel }, wallet);
  return NextResponse.json({ ok: true });
}
