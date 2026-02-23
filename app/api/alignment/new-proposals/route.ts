/**
 * New Proposals Count API
 * Returns count of proposals created after a given timestamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get('since');

  if (!sinceParam) {
    return NextResponse.json({ error: 'since (unix timestamp) is required' }, { status: 400 });
  }

  const since = parseInt(sinceParam, 10);
  if (isNaN(since)) {
    return NextResponse.json({ error: 'since must be a valid unix timestamp' }, { status: 400 });
  }

  try {
    const supabase = createClient();

    const { count, error } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .gt('block_time', since);

    if (error) {
      console.error('[API] new-proposals count error:', error.message);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
