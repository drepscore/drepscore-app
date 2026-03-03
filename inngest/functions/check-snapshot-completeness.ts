/**
 * Snapshot Completeness Check — daily backstop.
 * Runs at 06:00 UTC (after GHI at 04:30 and slow sync at 04:00).
 * Verifies every snapshot type has coverage for the current epoch/day.
 * Alerts Discord + PostHog on any gaps.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { alertDiscord, emitPostHog, type SyncType } from '@/lib/sync-utils';

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export const checkSnapshotCompleteness = inngest.createFunction(
  {
    id: 'check-snapshot-completeness',
    name: 'Snapshot Completeness Check',
    retries: 2,
  },
  { cron: '0 6 * * *' },
  async ({ step }) => {
    const checks = await step.run('run-completeness-checks', async () => {
      const supabase = getSupabaseAdmin();
      const today = new Date().toISOString().slice(0, 10);
      const results: CheckResult[] = [];

      const { data: statsRow } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const epoch = statsRow?.current_epoch ?? 0;

      if (epoch === 0) {
        return [{ name: 'epoch', passed: false, detail: 'Could not determine current epoch' }];
      }

      const { count: activeDrepCount } = await supabase
        .from('dreps')
        .select('id', { count: 'exact', head: true });
      const expectedDreps = activeDrepCount ?? 0;

      // 1. Score history for today
      const { count: scoreCount } = await supabase
        .from('drep_score_history')
        .select('drep_id', { count: 'exact', head: true })
        .eq('snapshot_date', today);
      const scoreCoverage = expectedDreps > 0 ? ((scoreCount ?? 0) / expectedDreps) * 100 : 0;
      results.push({
        name: 'drep_score_history',
        passed: scoreCoverage >= 90,
        detail: `${scoreCount ?? 0}/${expectedDreps} DReps (${scoreCoverage.toFixed(1)}%)`,
      });

      // 2. GHI snapshot for current epoch
      const { data: ghiRow } = await supabase
        .from('ghi_snapshots')
        .select('epoch_no')
        .eq('epoch_no', epoch)
        .maybeSingle();
      results.push({
        name: 'ghi_snapshots',
        passed: !!ghiRow,
        detail: ghiRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
      });

      // 3. Decentralization snapshot for current epoch
      const { data: ediRow } = await supabase
        .from('decentralization_snapshots')
        .select('epoch_no')
        .eq('epoch_no', epoch)
        .maybeSingle();
      results.push({
        name: 'decentralization_snapshots',
        passed: !!ediRow,
        detail: ediRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
      });

      // 4. Alignment snapshots for current epoch
      const { count: alignCount } = await supabase
        .from('alignment_snapshots')
        .select('drep_id', { count: 'exact', head: true })
        .eq('epoch', epoch);
      const alignCoverage = expectedDreps > 0 ? ((alignCount ?? 0) / expectedDreps) * 100 : 0;
      results.push({
        name: 'alignment_snapshots',
        passed: alignCoverage >= 80,
        detail: `${alignCount ?? 0}/${expectedDreps} DReps (${alignCoverage.toFixed(1)}%)`,
      });

      // 5. Power snapshots for current epoch
      const { count: powerCount } = await supabase
        .from('drep_power_snapshots')
        .select('drep_id', { count: 'exact', head: true })
        .eq('epoch_no', epoch);
      const powerCoverage = expectedDreps > 0 ? ((powerCount ?? 0) / expectedDreps) * 100 : 0;
      results.push({
        name: 'drep_power_snapshots',
        passed: powerCoverage >= 80,
        detail: `${powerCount ?? 0}/${expectedDreps} DReps (${powerCoverage.toFixed(1)}%)`,
      });

      // 6. Treasury snapshot for current epoch
      const { data: treasuryRow } = await supabase
        .from('treasury_snapshots')
        .select('epoch_no')
        .eq('epoch_no', epoch)
        .maybeSingle();
      results.push({
        name: 'treasury_snapshots',
        passed: !!treasuryRow,
        detail: treasuryRow ? `epoch ${epoch} present` : `epoch ${epoch} MISSING`,
      });

      return results;
    });

    const failures = checks.filter((c) => !c.passed);

    if (failures.length > 0) {
      await step.run('alert-failures', async () => {
        const failureList = failures.map((f) => `- **${f.name}**: ${f.detail}`).join('\n');

        await alertDiscord(
          'Snapshot Completeness Failed',
          `${failures.length} of ${checks.length} checks failed:\n${failureList}`,
        );

        await emitPostHog(false, 'scoring' as SyncType, 0, {
          event_override: 'snapshot_completeness_failed',
          failures: failures.map((f) => ({ name: f.name, detail: f.detail })),
          total_checks: checks.length,
        });
      });
    }

    console.log(
      `[snapshot-completeness] ${checks.length - failures.length}/${checks.length} passed`,
    );
    return {
      total: checks.length,
      passed: checks.length - failures.length,
      failed: failures.length,
      checks,
    };
  },
);
