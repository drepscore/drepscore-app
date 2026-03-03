/**
 * Epoch Summary Generator — runs daily, detects epoch transitions,
 * and writes per-user epoch_summary events to governance_events.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { errMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

const USER_BATCH = 50;

export const generateEpochSummary = inngest.createFunction(
  {
    id: 'generate-epoch-summary',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"epoch-summary"' },
  },
  { cron: '0 22 * * *' },
  async ({ step }) => {
    const epochInfo = await step.run('detect-epoch-transition', async () => {
      const supabase = getSupabaseAdmin();
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

      const { data: stats } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .limit(1)
        .single();

      const storedEpoch = stats?.current_epoch ?? 0;
      const isNewEpoch = currentEpoch > storedEpoch;

      if (isNewEpoch) {
        await supabase
          .from('governance_stats')
          .update({
            current_epoch: currentEpoch,
            epoch_end_time: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', stats?.current_epoch ? 1 : 1);
      }

      return { currentEpoch, previousEpoch: currentEpoch - 1, isNewEpoch, storedEpoch };
    });

    if (!epochInfo.isNewEpoch) {
      return { skipped: true, reason: `epoch ${epochInfo.currentEpoch} already processed` };
    }

    const epoch = epochInfo.previousEpoch;

    const proposalStats = await step.run('gather-proposal-stats', async () => {
      const supabase = getSupabaseAdmin();

      const [closedResult, openedResult, highlightResult] = await Promise.all([
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .or(
            `ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},expired_epoch.eq.${epoch},dropped_epoch.eq.${epoch}`,
          ),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('proposed_epoch', epoch),
        supabase
          .from('proposals')
          .select('title, ratified_epoch, enacted_epoch, expired_epoch, dropped_epoch')
          .or(
            `ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},expired_epoch.eq.${epoch},dropped_epoch.eq.${epoch}`,
          )
          .limit(1),
      ]);

      const highlight = highlightResult.data?.[0] ?? null;
      let highlightProposal: { title: string; outcome: string } | null = null;
      if (highlight) {
        const outcome =
          highlight.enacted_epoch === epoch
            ? 'enacted'
            : highlight.ratified_epoch === epoch
              ? 'ratified'
              : highlight.expired_epoch === epoch
                ? 'expired'
                : 'dropped';
        highlightProposal = { title: highlight.title || 'Untitled', outcome };
      }

      return {
        proposalsClosed: closedResult.count || 0,
        proposalsOpened: openedResult.count || 0,
        highlightProposal,
      };
    });

    const usersProcessed = await step.run('generate-user-summaries', async () => {
      const supabase = getSupabaseAdmin();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: activeUsers, error: userErr } = await supabase
        .from('users')
        .select('wallet_address, delegation_history')
        .gte('last_visit_at', thirtyDaysAgo);

      if (userErr || !activeUsers) {
        logger.error('[epoch-summary] Failed to fetch users', { error: userErr });
        return 0;
      }

      let processed = 0;
      for (let i = 0; i < activeUsers.length; i += USER_BATCH) {
        const batch = activeUsers.slice(i, i + USER_BATCH);
        const events = await Promise.all(
          batch.map(async (user) => {
            const drepId = extractDrepId(user.delegation_history);
            let drepVoteCount = 0;
            let drepRationaleCount = 0;
            let representationScore: number | null = null;
            let repScoreDelta: number | null = null;

            if (drepId) {
              const [votes, rationales, currentScore, prevScore] = await Promise.all([
                supabase
                  .from('drep_votes')
                  .select('vote_tx_hash', { count: 'exact', head: true })
                  .eq('drep_id', drepId)
                  .eq('epoch_no', epoch),
                supabase
                  .from('drep_votes')
                  .select('vote_tx_hash', { count: 'exact', head: true })
                  .eq('drep_id', drepId)
                  .eq('epoch_no', epoch)
                  .not('meta_url', 'is', null),
                supabase
                  .from('drep_score_history')
                  .select('score')
                  .eq('drep_id', drepId)
                  .order('created_at', { ascending: false })
                  .limit(1),
                supabase
                  .from('drep_score_history')
                  .select('score')
                  .eq('drep_id', drepId)
                  .order('created_at', { ascending: false })
                  .range(1, 1),
              ]);

              drepVoteCount = votes.count || 0;
              drepRationaleCount = rationales.count || 0;
              representationScore = currentScore.data?.[0]?.score ?? null;
              const prev = prevScore.data?.[0]?.score ?? null;
              if (representationScore !== null && prev !== null) {
                repScoreDelta = representationScore - prev;
              }
            }

            return {
              wallet_address: user.wallet_address,
              event_type: 'epoch_summary',
              event_data: {
                ...proposalStats,
                drepVoteCount,
                drepRationaleCount,
                representationScore,
                repScoreDelta,
              },
              related_drep_id: drepId || null,
              epoch,
              created_at: new Date().toISOString(),
            };
          }),
        );

        const { error: insertErr } = await supabase.from('governance_events').insert(events);

        if (insertErr) {
          logger.error('[epoch-summary] Insert error', { error: insertErr });
        } else {
          processed += events.length;
        }
      }

      return processed;
    });

    // Step 4: Enrich governance events (drep_vote + proposal_outcome events)
    const enrichResult = await step.run('enrich-governance-events', async () => {
      const supabase = getSupabaseAdmin();
      let eventsWritten = 0;

      // Write proposal_outcome events for proposals that concluded this epoch
      const { data: concludedProposals } = await supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, ratified_epoch, enacted_epoch, expired_epoch, dropped_epoch',
        )
        .or(
          `ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},expired_epoch.eq.${epoch},dropped_epoch.eq.${epoch}`,
        );

      if (concludedProposals && concludedProposals.length > 0) {
        // Find users who had their DRep vote on these proposals
        const txHashes = concludedProposals.map((p) => p.tx_hash);
        const { data: relevantVotes } = await supabase
          .from('drep_votes')
          .select('drep_id, proposal_tx_hash, proposal_index, vote')
          .in('proposal_tx_hash', txHashes);

        if (relevantVotes && relevantVotes.length > 0) {
          // Find delegators for each DRep that voted
          const drepIds = [...new Set(relevantVotes.map((v) => v.drep_id))];
          const { data: delegators } = await supabase
            .from('users')
            .select('wallet_address, delegation_history')
            .limit(500);

          const walletToDrep = new Map<string, string>();
          for (const u of delegators || []) {
            const drepId = extractDrepId(u.delegation_history);
            if (drepId && drepIds.includes(drepId)) {
              walletToDrep.set(u.wallet_address, drepId);
            }
          }

          const outcomeEvents = [];
          for (const [wallet, drepId] of walletToDrep) {
            for (const p of concludedProposals) {
              const vote = relevantVotes.find(
                (v) => v.drep_id === drepId && v.proposal_tx_hash === p.tx_hash,
              );
              if (!vote) continue;

              const outcome =
                p.enacted_epoch === epoch
                  ? 'enacted'
                  : p.ratified_epoch === epoch
                    ? 'ratified'
                    : p.expired_epoch === epoch
                      ? 'expired'
                      : 'dropped';

              outcomeEvents.push({
                id: crypto.randomUUID(),
                wallet_address: wallet,
                event_type: 'proposal_outcome',
                event_data: {
                  proposal_tx_hash: p.tx_hash,
                  proposal_index: p.proposal_index,
                  title: p.title,
                  outcome,
                  drep_vote: vote.vote,
                },
                related_drep_id: drepId,
                epoch,
                created_at: new Date().toISOString(),
              });
            }
          }

          if (outcomeEvents.length > 0) {
            const { error } = await supabase
              .from('governance_events')
              .insert(outcomeEvents.slice(0, 500));
            if (!error) eventsWritten += Math.min(outcomeEvents.length, 500);
          }
        }
      }

      return { eventsWritten };
    });

    // Step 5: Generate epoch recap with stats
    const recapResult = await step.run('generate-epoch-recap', async () => {
      const supabase = getSupabaseAdmin();

      const [ratifiedResult, expiredResult, droppedResult, submittedResult] = await Promise.all([
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('ratified_epoch', epoch),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('expired_epoch', epoch),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('dropped_epoch', epoch),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('proposed_epoch', epoch),
      ]);

      const ratified = ratifiedResult.count || 0;
      const expired = expiredResult.count || 0;
      const dropped = droppedResult.count || 0;
      const submitted = submittedResult.count || 0;

      // DRep participation: count DReps who voted this epoch vs total active
      const [votersResult, totalDrepsResult] = await Promise.all([
        supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
        supabase
          .from('dreps')
          .select('drep_id', { count: 'exact', head: true })
          .eq('registered', true),
      ]);

      const uniqueVoters = new Set((votersResult.data || []).map((v) => v.drep_id)).size;
      const totalDreps = totalDrepsResult.count || 1;
      const participationPct = Math.round((uniqueVoters / totalDreps) * 100 * 10) / 10;

      // Treasury withdrawn this epoch
      const { data: treasuryData } = await supabase
        .from('proposals')
        .select('withdrawal_amount')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .eq('enacted_epoch', epoch);

      const treasuryWithdrawn = (treasuryData || []).reduce(
        (sum, p) => sum + (p.withdrawal_amount || 0),
        0,
      );

      const narrative = [
        `Epoch ${epoch}:`,
        submitted > 0 ? `${submitted} proposals submitted` : null,
        ratified > 0 ? `${ratified} ratified` : null,
        expired > 0 ? `${expired} expired` : null,
        dropped > 0 ? `${dropped} dropped` : null,
        `${participationPct}% DRep participation`,
        treasuryWithdrawn > 0
          ? `${Math.round(treasuryWithdrawn / 1_000_000)}M ADA withdrawn from treasury`
          : null,
      ]
        .filter(Boolean)
        .join(', ');

      const { error: upsertErr } = await supabase.from('epoch_recaps').upsert(
        {
          epoch,
          proposals_submitted: submitted,
          proposals_ratified: ratified,
          proposals_expired: expired,
          proposals_dropped: dropped,
          drep_participation_pct: participationPct,
          treasury_withdrawn_ada: Math.round(treasuryWithdrawn),
          ai_narrative: narrative,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'epoch' },
      );

      if (upsertErr) {
        logger.error('[epoch-summary] Epoch recap upsert error', { error: upsertErr });
        return { success: false, error: upsertErr.message };
      }

      return { success: true, epoch, narrative };
    });

    // Step 6: Governance participation snapshot (system-wide metrics for this epoch)
    const participationSnapshot = await step.run('snapshot-governance-participation', async () => {
      try {
        const supabase = getSupabaseAdmin();

        const { data: existing } = await supabase
          .from('governance_participation_snapshots')
          .select('epoch')
          .eq('epoch', epoch)
          .maybeSingle();
        if (existing) return { skipped: true };

        const [votersResult, totalDrepsResult, totalPowerResult, rationaleResult] =
          await Promise.all([
            supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
            supabase
              .from('dreps')
              .select('drep_id', { count: 'exact', head: true })
              .eq('registered', true),
            supabase.from('dreps').select('info').eq('registered', true),
            supabase
              .from('drep_votes')
              .select('vote_tx_hash', { count: 'exact', head: true })
              .eq('epoch_no', epoch)
              .not('meta_url', 'is', null),
          ]);

        const uniqueVoters = new Set((votersResult.data || []).map((v) => v.drep_id));
        const activeDreps = uniqueVoters.size;
        const totalDreps = totalDrepsResult.count || 1;
        const participationRate = Math.round((activeDreps / totalDreps) * 10000) / 100;

        const totalVotes = votersResult.data?.length ?? 0;
        const rationaleCount = rationaleResult.count ?? 0;
        const rationaleRate =
          totalVotes > 0 ? Math.round((rationaleCount / totalVotes) * 10000) / 100 : 0;

        const totalPower = (totalPowerResult.data || []).reduce((sum, row) => {
          const info = row.info as Record<string, unknown>;
          return sum + BigInt((info?.votingPowerLovelace as string) || '0');
        }, BigInt(0));

        const { error } = await supabase.from('governance_participation_snapshots').insert({
          epoch,
          active_drep_count: activeDreps,
          total_drep_count: totalDreps,
          participation_rate: participationRate,
          rationale_rate: rationaleRate,
          total_voting_power_lovelace: totalPower.toString(),
        });

        if (error) throw new Error(error.message);

        await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'governance_participation',
            epoch_no: epoch,
            snapshot_date: new Date().toISOString().slice(0, 10),
            record_count: 1,
            expected_count: 1,
            coverage_pct: 100,
            metadata: { participation_rate: participationRate },
          },
          { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
        );

        logger.info('[epoch-summary] Participation snapshot stored', {
          activeDreps,
          totalDreps,
          participationRate,
          epoch,
        });
        return { inserted: true, activeDreps, totalDreps, participationRate };
      } catch (err) {
        logger.error('[epoch-summary] Participation snapshot failed', { error: err });
        return { error: errMsg(err) };
      }
    });

    logger.info('[epoch-summary] Epoch summary generated', { epoch, usersProcessed });
    return {
      epoch,
      usersProcessed,
      ...proposalStats,
      recap: recapResult,
      enrichment: enrichResult,
      participation: participationSnapshot,
    };
  },
);

function extractDrepId(history: unknown): string | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const latest = history[history.length - 1];
  return typeof latest === 'object' && latest !== null && 'drepId' in latest
    ? (latest as { drepId: string }).drepId
    : null;
}
