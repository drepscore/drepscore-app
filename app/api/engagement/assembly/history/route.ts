import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async () => {
    const supabase = getSupabaseAdmin();

    const { data: assemblies } = await supabase
      .from('citizen_assemblies')
      .select('*')
      .eq('status', 'closed')
      .order('closes_at', { ascending: false })
      .limit(20);

    const result = (assemblies || []).map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      question: a.question,
      options: a.options,
      status: a.status,
      epoch: a.epoch,
      opensAt: a.opens_at,
      closesAt: a.closes_at,
      results: a.results,
      totalVotes: a.total_votes,
    }));

    return NextResponse.json(result);
  },
  { auth: 'optional' },
);
