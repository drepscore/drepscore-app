import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { AssemblyVoteSchema } from '@/lib/api/schemas/engagement';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const walletAddress = wallet!;
    const { assemblyId, selectedOption, stakeAddress } = AssemblyVoteSchema.parse(
      await request.json(),
    );

    const supabase = getSupabaseAdmin();

    // Verify assembly is active
    const now = new Date().toISOString();
    const { data: assembly } = await supabase
      .from('citizen_assemblies')
      .select('id, status, opens_at, closes_at, options')
      .eq('id', assemblyId)
      .single();

    if (!assembly || assembly.status !== 'active') {
      return NextResponse.json({ error: 'Assembly not found or not active' }, { status: 404 });
    }

    if (now < assembly.opens_at || now > assembly.closes_at) {
      return NextResponse.json({ error: 'Assembly voting window is closed' }, { status: 400 });
    }

    // Verify selectedOption is valid
    const options = (assembly.options as { key: string }[]) || [];
    if (!options.some((o) => o.key === selectedOption)) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }

    const { error: insertError } = await supabase.from('citizen_assembly_responses').insert({
      assembly_id: assemblyId,
      user_id: userId!,
      wallet_address: walletAddress,
      stake_address: stakeAddress || null,
      selected_option: selectedOption,
    });

    if (insertError) {
      // Unique constraint = already voted
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Already voted in this assembly' }, { status: 409 });
      }
      logger.error('Assembly vote insert error', {
        context: 'engagement/assembly/vote',
        error: insertError.message,
      });
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
    }

    // Update total count on assembly
    const { count } = await supabase
      .from('citizen_assembly_responses')
      .select('id', { count: 'exact', head: true })
      .eq('assembly_id', assemblyId);

    await supabase
      .from('citizen_assemblies')
      .update({ total_votes: count ?? 0 })
      .eq('id', assemblyId);

    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    supabase
      .from('governance_events')
      .insert({
        user_id: userId!,
        wallet_address: walletAddress,
        event_type: 'assembly_vote',
        event_data: { assemblyId, selectedOption },
        epoch: currentEpoch,
      })
      .then(({ error: evtErr }) => {
        if (evtErr)
          logger.error('governance_event write failed', {
            context: 'assembly-vote',
            error: evtErr.message,
          });
      });

    captureServerEvent(
      'citizen_assembly_voted',
      { assembly_id: assemblyId, selected_option: selectedOption },
      walletAddress,
    );

    return NextResponse.json({ success: true });
  },
  { auth: 'required', rateLimit: { max: 5, window: 60 } },
);
