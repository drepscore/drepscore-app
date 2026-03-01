import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalPriority } from '@/utils/proposalPriority';
import { HomepageDualMode } from '@/components/HomepageDualMode';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

async function getGovernancePulse() {
  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
  const oneWeekAgoBlockTime = Math.floor(Date.now() / 1000) - 604800;

  const [drepsResult, proposalsResult, votesResult, claimedResult] = await Promise.all([
    supabase.from('dreps').select('score, participation_rate, rationale_rate, effective_participation, info, size_tier'),
    supabase.from('proposals').select('tx_hash, proposal_index, proposal_type, title, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, created_at'),
    supabase.from('drep_votes').select('id', { count: 'exact', head: true }).gt('block_time', oneWeekAgoBlockTime),
    supabase.from('users').select('wallet_address', { count: 'exact', head: true }).not('claimed_drep_id', 'is', null),
  ]);

  const dreps = drepsResult.data || [];
  const proposals = proposalsResult.data || [];
  const activeDReps = dreps.filter((d: any) => d.info?.isActive);

  const totalLovelace = activeDReps.reduce((sum: number, d: any) => {
    const lv = parseInt(d.info?.votingPowerLovelace || '0', 10);
    return sum + (isNaN(lv) ? 0 : lv);
  }, 0);
  const totalAda = totalLovelace / 1_000_000;
  const formattedAda = totalAda >= 1_000_000_000
    ? `${(totalAda / 1_000_000_000).toFixed(1)}B`
    : totalAda >= 1_000_000
      ? `${(totalAda / 1_000_000).toFixed(1)}M`
      : `${Math.round(totalAda).toLocaleString()}`;

  const pRates = dreps.map((d: any) => d.effective_participation || 0).filter((r: number) => r > 0);
  const rRates = dreps.map((d: any) => d.rationale_rate || 0).filter((r: number) => r > 0);
  const avgP = pRates.length > 0 ? Math.round(pRates.reduce((a: number, b: number) => a + b, 0) / pRates.length) : 0;
  const avgR = rRates.length > 0 ? Math.round(rRates.reduce((a: number, b: number) => a + b, 0) / rRates.length) : 0;

  const openProposals = proposals.filter(
    (p: any) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch
  );
  const criticalCount = openProposals.filter(
    (p: any) => getProposalPriority(p.proposal_type) === 'critical'
  ).length;

  const spotlight = openProposals.filter((p: any) => p.title).sort((a: any, b: any) => {
    return (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0);
  })[0] || null;

  return {
    totalAdaGoverned: formattedAda,
    totalAdaGovernedRaw: totalLovelace,
    activeProposals: openProposals.length,
    criticalProposals: criticalCount,
    avgParticipationRate: avgP,
    avgRationaleRate: avgR,
    totalDReps: dreps.length,
    activeDReps: activeDReps.length,
    votesThisWeek: votesResult.count || 0,
    claimedDReps: claimedResult.count || 0,
    spotlightProposal: spotlight ? {
      txHash: spotlight.tx_hash,
      index: spotlight.proposal_index,
      title: spotlight.title,
      proposalType: spotlight.proposal_type,
      priority: getProposalPriority(spotlight.proposal_type),
    } : null,
    currentEpoch,
  };
}

async function getTopDReps() {
  const supabase = createClient();
  const { data } = await supabase
    .from('dreps')
    .select('id, score, effective_participation, size_tier, info')
    .eq('info->>isActive', 'true')
    .order('score', { ascending: false })
    .limit(6);

  return (data || []).map((row: any) => ({
    drepId: row.id,
    name: row.info?.name || null,
    ticker: row.info?.ticker || null,
    handle: row.info?.handle || null,
    drepScore: row.score || 0,
    sizeTier: row.size_tier || 'small',
    effectiveParticipation: row.effective_participation || 0,
  }));
}

export default async function HomePage() {
  const [pulseData, topDReps] = await Promise.all([
    getGovernancePulse(),
    getTopDReps(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <HomepageDualMode pulseData={pulseData} topDReps={topDReps} />
    </div>
  );
}
