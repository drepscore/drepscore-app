import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();

    const [statsResult, enactedResult] = await Promise.all([
      supabase
        .from('governance_stats')
        .select('treasury_balance_lovelace, treasury_balance_updated_at')
        .eq('id', 1)
        .single(),
      supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, withdrawal_amount, enacted_epoch')
        .not('enacted_epoch', 'is', null)
        .not('withdrawal_amount', 'is', null)
        .order('enacted_epoch', { ascending: false }),
    ]);

    const stats = statsResult.data;
    const enacted = enactedResult.data || [];

    const treasuryLovelace = Number(stats?.treasury_balance_lovelace || 0);
    const treasuryAda = treasuryLovelace / 1_000_000;

    let treasuryBalanceFormatted: string;
    if (treasuryAda >= 1_000_000_000) {
      treasuryBalanceFormatted = `${(treasuryAda / 1_000_000_000).toFixed(2)}B`;
    } else if (treasuryAda >= 1_000_000) {
      treasuryBalanceFormatted = `${(treasuryAda / 1_000_000).toFixed(1)}M`;
    } else if (treasuryAda >= 1_000) {
      treasuryBalanceFormatted = `${(treasuryAda / 1_000).toFixed(1)}K`;
    } else {
      treasuryBalanceFormatted = Math.round(treasuryAda).toLocaleString();
    }

    const totalApprovedLovelace = enacted.reduce(
      (sum: number, p: any) => sum + Number(p.withdrawal_amount || 0),
      0,
    );
    const totalApproved = totalApprovedLovelace / 1_000_000;

    const recentWithdrawals = enacted.slice(0, 3).map((p: any) => ({
      txHash: p.tx_hash,
      index: p.proposal_index,
      title: p.title || 'Untitled',
      amountAda: Number(p.withdrawal_amount || 0) / 1_000_000,
      enactedEpoch: p.enacted_epoch,
    }));

    // Burn rate: total enacted withdrawals / months since first enacted
    // Each Cardano epoch ≈ 5 days → ~6 epochs per month
    let burnRatePerMonth = 0;
    let estimatedRunwayMonths = 0;
    if (enacted.length > 0) {
      const firstEpoch = enacted[enacted.length - 1].enacted_epoch;
      const lastEpoch = enacted[0].enacted_epoch;
      const epochSpan = lastEpoch - firstEpoch + 1;
      const monthsSpan = Math.max(epochSpan / 6, 1);
      burnRatePerMonth = totalApproved / monthsSpan;
      estimatedRunwayMonths =
        burnRatePerMonth > 0 ? Math.round(treasuryAda / burnRatePerMonth) : 0;
    }

    return NextResponse.json({
      treasuryBalance: treasuryAda,
      treasuryBalanceFormatted,
      recentWithdrawals,
      totalApproved,
      burnRatePerMonth: Math.round(burnRatePerMonth),
      estimatedRunwayMonths,
      lastUpdated: stats?.treasury_balance_updated_at || null,
    });
  } catch (err) {
    console.error('[Treasury API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
