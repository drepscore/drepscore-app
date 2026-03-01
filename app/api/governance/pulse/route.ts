import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalPriority } from '@/utils/proposalPriority';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  try {
    const supabase = createClient();
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const oneWeekAgoBlockTime = Math.floor(Date.now() / 1000) - 604800;

    const [
      drepsResult,
      proposalsResult,
      votesThisWeekResult,
      claimedResult,
    ] = await Promise.all([
      supabase.from('dreps').select('score, participation_rate, rationale_rate, effective_participation, info, size_tier'),
      supabase.from('proposals').select('tx_hash, proposal_index, proposal_type, title, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, created_at'),
      supabase.from('drep_votes').select('id', { count: 'exact', head: true }).gt('block_time', oneWeekAgoBlockTime),
      supabase.from('users').select('wallet_address', { count: 'exact', head: true }).not('claimed_drep_id', 'is', null),
    ]);

    const dreps = drepsResult.data || [];
    const proposals = proposalsResult.data || [];

    const activeDReps = dreps.filter((d: any) => d.info?.isActive);
    const totalAdaGovernedLovelace = activeDReps.reduce((sum: number, d: any) => {
      const lovelace = parseInt(d.info?.votingPowerLovelace || '0', 10);
      return sum + (isNaN(lovelace) ? 0 : lovelace);
    }, 0);

    const totalAdaGoverned = totalAdaGovernedLovelace / 1_000_000;
    let formattedAda: string;
    if (totalAdaGoverned >= 1_000_000_000) {
      formattedAda = `${(totalAdaGoverned / 1_000_000_000).toFixed(1)}B`;
    } else if (totalAdaGoverned >= 1_000_000) {
      formattedAda = `${(totalAdaGoverned / 1_000_000).toFixed(1)}M`;
    } else {
      formattedAda = `${Math.round(totalAdaGoverned).toLocaleString()}`;
    }

    const participationRates = dreps.map((d: any) => d.effective_participation || 0).filter((r: number) => r > 0);
    const rationaleRates = dreps.map((d: any) => d.rationale_rate || 0).filter((r: number) => r > 0);
    const avgParticipation = participationRates.length > 0
      ? Math.round(participationRates.reduce((a: number, b: number) => a + b, 0) / participationRates.length)
      : 0;
    const avgRationale = rationaleRates.length > 0
      ? Math.round(rationaleRates.reduce((a: number, b: number) => a + b, 0) / rationaleRates.length)
      : 0;

    const openProposals = proposals.filter(
      (p: any) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch
    );
    const criticalCount = openProposals.filter(
      (p: any) => getProposalPriority(p.proposal_type) === 'critical'
    ).length;

    const spotlight = openProposals
      .filter((p: any) => p.title)
      .sort((a: any, b: any) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })[0] || null;

    return NextResponse.json({
      totalAdaGoverned: formattedAda,
      totalAdaGovernedRaw: totalAdaGovernedLovelace,
      activeProposals: openProposals.length,
      criticalProposals: criticalCount,
      avgParticipationRate: avgParticipation,
      avgRationaleRate: avgRationale,
      totalDReps: dreps.length,
      activeDReps: activeDReps.length,
      votesThisWeek: votesThisWeekResult.count || 0,
      claimedDReps: claimedResult.count || 0,
      spotlightProposal: spotlight ? {
        txHash: spotlight.tx_hash,
        index: spotlight.proposal_index,
        title: spotlight.title,
        proposalType: spotlight.proposal_type,
        priority: getProposalPriority(spotlight.proposal_type),
      } : null,
      currentEpoch,
    });
  } catch (err) {
    console.error('[Governance Pulse API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
