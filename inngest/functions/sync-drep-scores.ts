/**
 * Dedicated DRep Score V3 sync function.
 * Triggered after sync-dreps completes. Computes 4-pillar scores,
 * percentile-normalizes, computes composite + momentum, persists to DB.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import {
  computeEngagementQuality,
  computeEffectiveParticipation,
  getExtendedImportanceWeight,
  computeReliability,
  computeGovernanceIdentity,
  computeDRepScores,
  type VoteData,
  type ProposalScoringContext,
  type ProposalVotingSummary,
  type DRepProfileData,
} from '@/lib/scoring';
import { batchUpsert, SyncLogger, errMsg, emitPostHog } from '@/lib/sync-utils';

export const syncDrepScores = inngest.createFunction(
  {
    id: 'sync-drep-scores',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"scoring-compute"' },
  },
  [{ event: 'drepscore/sync.scores' }],
  async ({ step }) => {
    const result = await step.run('compute-drep-scores', async () => {
      const supabase = getSupabaseAdmin();
      const logger = new SyncLogger(supabase, 'scoring' as any);
      await logger.start();
      const timing: Record<string, number> = {};

      try {
        // ── Step 1: Load all data ──────────────────────────────────────
        const s1 = Date.now();

        const [
          { data: drepRows },
          { data: voteRows },
          { data: proposalRows },
          { data: summaryRows },
        ] = await Promise.all([
          supabase.from('dreps').select('id, info, metadata, metadata_hash_verified, anchor_hash'),
          supabase
            .from('drep_votes')
            .select(
              'drep_id, proposal_tx_hash, proposal_index, vote, block_time, epoch_no, rationale_quality',
            ),
          supabase
            .from('proposals')
            .select(
              'tx_hash, proposal_index, proposal_type, treasury_tier, withdrawal_amount, block_time, proposed_epoch, expired_epoch, ratified_epoch, dropped_epoch',
            ),
          supabase
            .from('proposal_voting_summary')
            .select(
              'proposal_tx_hash, proposal_index, drep_yes_vote_power, drep_no_vote_power, drep_abstain_vote_power',
            ),
        ]);

        if (!drepRows?.length || !voteRows?.length) {
          console.log('[scoring] No DReps or votes — skipping');
          return { success: true, skipped: true };
        }

        timing.step1_load_ms = Date.now() - s1;

        // ── Step 2: Build lookup maps ──────────────────────────────────
        const s2 = Date.now();
        const nowSeconds = Math.floor(Date.now() / 1000);
        const currentEpoch = blockTimeToEpoch(nowSeconds);

        // Proposal context map
        const proposalContexts = new Map<string, ProposalScoringContext>();
        const allProposalTypes = new Set<string>();
        const proposalBlockTimes = new Map<string, number>();

        for (const p of (proposalRows || []) as any[]) {
          const key = `${p.tx_hash}-${p.proposal_index}`;
          const weight = getExtendedImportanceWeight(
            p.proposal_type,
            p.treasury_tier,
            p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null,
          );
          proposalContexts.set(key, {
            proposalKey: key,
            proposalType: p.proposal_type,
            treasuryTier: p.treasury_tier,
            withdrawalAmount: p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null,
            blockTime: p.block_time || 0,
            importanceWeight: weight,
          });
          allProposalTypes.add(p.proposal_type);
          proposalBlockTimes.set(key, p.block_time || 0);
        }

        // Voting summary map (for margins + majority)
        const votingSummaries = new Map<string, ProposalVotingSummary>();
        for (const s of (summaryRows || []) as any[]) {
          const key = `${s.proposal_tx_hash}-${s.proposal_index}`;
          votingSummaries.set(key, {
            proposalKey: key,
            drepYesVotePower: Number(s.drep_yes_vote_power) || 0,
            drepNoVotePower: Number(s.drep_no_vote_power) || 0,
            drepAbstainVotePower: Number(s.drep_abstain_vote_power) || 0,
          });
        }

        // Active proposal epochs for reliability
        const proposalEpochs = new Map<number, number>();
        for (const p of (proposalRows || []) as any[]) {
          if (p.proposed_epoch == null) continue;
          const start = p.proposed_epoch;
          const endEpoch = Math.min(
            ...[p.expired_epoch, p.ratified_epoch, p.dropped_epoch, currentEpoch].filter(
              (e: number | null): e is number => e != null,
            ),
          );
          for (let e = start; e <= endEpoch; e++) {
            proposalEpochs.set(e, (proposalEpochs.get(e) || 0) + 1);
          }
        }

        // Group votes by DRep with enriched VoteData
        const drepVotes = new Map<string, VoteData[]>();
        const drepEpochData = new Map<string, { counts: number[]; firstEpoch: number }>();

        // Temp: epoch counts per DRep
        const drepEpochCounts = new Map<string, Map<number, number>>();

        for (const v of voteRows as any[]) {
          const proposalKey = `${v.proposal_tx_hash}-${v.proposal_index}`;
          const ctx = proposalContexts.get(proposalKey);

          const voteData: VoteData = {
            drepId: v.drep_id,
            proposalKey,
            vote: v.vote,
            blockTime: v.block_time,
            proposalBlockTime: proposalBlockTimes.get(proposalKey) || 0,
            proposalType: ctx?.proposalType || 'InfoAction',
            rationaleQuality: v.rationale_quality,
            importanceWeight: ctx?.importanceWeight || 1,
          };

          if (!drepVotes.has(v.drep_id)) drepVotes.set(v.drep_id, []);
          drepVotes.get(v.drep_id)!.push(voteData);

          // Track epoch counts
          const epoch = v.epoch_no ?? blockTimeToEpoch(v.block_time);
          if (epoch != null) {
            if (!drepEpochCounts.has(v.drep_id)) drepEpochCounts.set(v.drep_id, new Map());
            const ec = drepEpochCounts.get(v.drep_id)!;
            ec.set(epoch, (ec.get(epoch) || 0) + 1);
          }
        }

        // Convert epoch count maps to arrays
        for (const [drepId, epochMap] of drepEpochCounts) {
          const epochs = [...epochMap.keys()].sort((a, b) => a - b);
          if (epochs.length === 0) continue;
          const firstEpoch = epochs[0];
          const lastEpoch = Math.max(epochs[epochs.length - 1], currentEpoch);
          const counts: number[] = [];
          for (let e = firstEpoch; e <= lastEpoch; e++) {
            counts.push(epochMap.get(e) || 0);
          }
          drepEpochData.set(drepId, { counts, firstEpoch });
        }

        // Ensure all DReps from the dreps table have entries (even those with 0 votes)
        for (const row of drepRows as any[]) {
          if (!drepVotes.has(row.id)) drepVotes.set(row.id, []);
        }

        // Profile data for governance identity
        const profiles = new Map<string, DRepProfileData>();
        const allDelegatorCounts: number[] = [];

        for (const row of drepRows as any[]) {
          const info = (row.info || {}) as Record<string, unknown>;
          const delegatorCount = (info.delegatorCount as number) || 0;

          profiles.set(row.id, {
            drepId: row.id,
            metadata: row.metadata || null,
            delegatorCount,
            metadataHashVerified: row.metadata_hash_verified || false,
          });
          allDelegatorCounts.push(delegatorCount);
        }

        timing.step2_build_maps_ms = Date.now() - s2;

        // ── Step 3: Compute raw pillar scores ──────────────────────────
        const s3 = Date.now();

        const rawEngagement = computeEngagementQuality(
          drepVotes,
          votingSummaries,
          allProposalTypes,
          nowSeconds,
        );

        const rawParticipation = computeEffectiveParticipation(
          drepVotes,
          proposalContexts,
          votingSummaries,
          nowSeconds,
        );

        const rawReliability = computeReliability(
          drepVotes,
          proposalEpochs,
          currentEpoch,
          drepEpochData,
        );

        const rawIdentity = computeGovernanceIdentity(profiles, allDelegatorCounts);

        timing.step3_compute_pillars_ms = Date.now() - s3;

        // ── Step 4: Load score history for momentum ────────────────────
        const s4 = Date.now();
        const drepIds = [...drepVotes.keys()];

        const { data: historyRows } = await supabase
          .from('drep_score_history')
          .select('drep_id, snapshot_date, score')
          .in('drep_id', drepIds)
          .gte('snapshot_date', new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10))
          .order('snapshot_date', { ascending: true });

        const scoreHistory = new Map<string, { date: string; score: number }[]>();
        for (const h of (historyRows || []) as any[]) {
          if (!scoreHistory.has(h.drep_id)) scoreHistory.set(h.drep_id, []);
          scoreHistory.get(h.drep_id)!.push({ date: h.snapshot_date, score: h.score });
        }

        timing.step4_load_history_ms = Date.now() - s4;

        // ── Step 5: Composite + percentile + momentum ──────────────────
        const s5 = Date.now();

        const finalScores = computeDRepScores(
          rawEngagement,
          rawParticipation,
          rawReliability,
          rawIdentity,
          scoreHistory,
        );

        timing.step5_composite_ms = Date.now() - s5;

        // ── Step 6: Persist to DB ──────────────────────────────────────
        const s6 = Date.now();

        const drepUpdates = [...finalScores.entries()].map(([drepId, s]) => ({
          id: drepId,
          score: s.composite,
          engagement_quality: s.engagementQualityPercentile,
          engagement_quality_raw: s.engagementQualityRaw,
          effective_participation_v3: s.effectiveParticipationPercentile,
          effective_participation_v3_raw: s.effectiveParticipationRaw,
          reliability_v3: s.reliabilityPercentile,
          reliability_v3_raw: s.reliabilityRaw,
          governance_identity: s.governanceIdentityPercentile,
          governance_identity_raw: s.governanceIdentityRaw,
          score_momentum: s.momentum,
        }));

        await batchUpsert(
          supabase,
          'dreps',
          drepUpdates as unknown as Record<string, unknown>[],
          'id',
          'DRep Score V3',
        );

        // Snapshot to score history
        const today = new Date().toISOString().slice(0, 10);
        const historyInserts = [...finalScores.entries()].map(([drepId, s]) => ({
          drep_id: drepId,
          snapshot_date: today,
          score: s.composite,
          engagement_quality: s.engagementQualityPercentile,
          effective_participation_v3: s.effectiveParticipationPercentile,
          reliability_v3: s.reliabilityPercentile,
          governance_identity: s.governanceIdentityPercentile,
          // Keep legacy columns populated for backward compat
          effective_participation: s.effectiveParticipationPercentile,
          rationale_rate: s.engagementQualityPercentile,
          reliability_score: s.reliabilityPercentile,
          profile_completeness: s.governanceIdentityPercentile,
        }));

        await batchUpsert(
          supabase,
          'drep_score_history',
          historyInserts as unknown as Record<string, unknown>[],
          'drep_id,snapshot_date',
          'Score history V3',
        );

        timing.step6_persist_ms = Date.now() - s6;

        const summary = {
          success: true,
          drepsScored: finalScores.size,
          proposalsLoaded: proposalContexts.size,
          votesProcessed: voteRows.length,
          timing,
        };

        console.log('[scoring] DRep Score V3 sync complete:', JSON.stringify(summary));
        await logger.finalize(true, null, summary as Record<string, unknown>);
        await emitPostHog(true, 'scoring' as any, logger.elapsed, summary as Record<string, unknown>);
        return summary;
      } catch (err) {
        const msg = errMsg(err);
        console.error('[scoring] Fatal error:', msg);
        await logger.finalize(false, msg, timing);
        throw err;
      }
    });

    return result;
  },
);
