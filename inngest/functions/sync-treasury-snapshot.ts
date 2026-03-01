/**
 * Treasury Snapshot Sync — runs alongside epoch sync.
 * Fetches current treasury balance from Koios /totals and stores epoch-level snapshots.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchTreasuryBalance, fetchTreasuryHistory } from '@/utils/koios';
import { blockTimeToEpoch } from '@/lib/koios';

export const syncTreasurySnapshot = inngest.createFunction(
  {
    id: 'sync-treasury-snapshot',
    retries: 3,
    concurrency: { limit: 1, scope: 'env', key: '"treasury-sync"' },
  },
  { cron: '30 22 * * *' },
  async ({ step }) => {

    const snapshot = await step.run('fetch-treasury-balance', async () => {
      const treasury = await fetchTreasuryBalance();
      return {
        epoch: treasury.epoch,
        balanceLovelace: treasury.balance.toString(),
        reservesLovelace: treasury.reserves.toString(),
      };
    });

    const withdrawals = await step.run('calculate-epoch-withdrawals', async () => {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('proposals')
        .select('withdrawal_amount')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .eq('enacted_epoch', snapshot.epoch);

      const total = (data || []).reduce((sum, p) => sum + BigInt(p.withdrawal_amount || 0) * BigInt(1_000_000), BigInt(0));
      return total.toString();
    });

    const prevSnapshot = await step.run('calculate-income', async () => {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('treasury_snapshots')
        .select('balance_lovelace, epoch_no')
        .eq('epoch_no', snapshot.epoch - 1)
        .single();

      return data;
    });

    const reservesIncome = prevSnapshot
      ? (BigInt(snapshot.balanceLovelace) - BigInt(prevSnapshot.balance_lovelace) + BigInt(withdrawals)).toString()
      : '0';

    await step.run('upsert-snapshot', async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from('treasury_snapshots')
        .upsert({
          epoch_no: snapshot.epoch,
          balance_lovelace: snapshot.balanceLovelace,
          reserves_lovelace: snapshot.reservesLovelace,
          withdrawals_lovelace: withdrawals,
          reserves_income_lovelace: reservesIncome,
          snapshot_at: new Date().toISOString(),
        }, { onConflict: 'epoch_no' });

      if (error) throw new Error(`Treasury snapshot upsert failed: ${error.message}`);
    });

    return { epoch: snapshot.epoch, balance: snapshot.balanceLovelace };
  }
);
