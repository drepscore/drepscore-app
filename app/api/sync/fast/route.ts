/**
 * Fast Sync — runs every 30 min via Vercel Pro cron.
 * Lightweight: only updates open proposal lifecycle + votes on open proposals.
 * Target: under 15 seconds execution.
 *
 * Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET> header automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { blockTimeToEpoch } from '@/lib/koios';
import { fetchProposals, fetchVotesForProposals, fetchProposalVotingSummary } from '@/utils/koios';
import { classifyProposals } from '@/lib/alignment';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BATCH_SIZE = 100;

const SUMMARY_CONCURRENCY = 5;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ success: false, error: `Supabase init: ${msg}` }, { status: 500 });
  }

  console.log('[FastSync] Starting...');

  let syncLogId: number | null = null;
  try {
    const { data: logRow } = await supabase.from('sync_log')
      .insert({ sync_type: 'fast', started_at: new Date().toISOString(), success: false })
      .select('id').single();
    syncLogId = logRow?.id ?? null;
  } catch { /* best-effort */ }

  const errors: string[] = [];
  let proposalCount = 0;
  let voteCount = 0;
  let pushSent = 0;
  let proposalOk = false;
  let voteOk = false;

  try {
    // ── Fetch proposals from Koios ───────────────────────────────────────────

    let openProposals: { txHash: string; index: number }[] = [];

    try {
      const rawProposals = await fetchProposals();
      const classified = classifyProposals(rawProposals);

      const proposalRows = [...new Map(
        classified.map(p => [`${p.txHash}-${p.index}`, {
          tx_hash: p.txHash, proposal_index: p.index, proposal_id: p.proposalId,
          proposal_type: p.type,
          title: p.title, abstract: p.abstract,
          withdrawal_amount: p.withdrawalAmountAda, treasury_tier: p.treasuryTier,
          param_changes: p.paramChanges, relevant_prefs: p.relevantPrefs,
          proposed_epoch: p.proposedEpoch, block_time: p.blockTime,
          expired_epoch: p.expiredEpoch, ratified_epoch: p.ratifiedEpoch,
          enacted_epoch: p.enactedEpoch, dropped_epoch: p.droppedEpoch,
          expiration_epoch: p.expirationEpoch,
        }])
      ).values()];

      for (let i = 0; i < proposalRows.length; i += BATCH_SIZE) {
        const batch = proposalRows.slice(i, i + BATCH_SIZE);
        await supabase.from('proposals')
          .upsert(batch, { onConflict: 'tx_hash,proposal_index', ignoreDuplicates: false });
      }
      proposalCount = proposalRows.length;
      proposalOk = true;

      openProposals = classified
        .filter(p => !p.ratifiedEpoch && !p.enactedEpoch && !p.droppedEpoch && !p.expiredEpoch)
        .map(p => ({ txHash: p.txHash, index: p.index }));

      console.log(`[FastSync] Proposals: ${proposalCount} upserted, ${openProposals.length} open`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Proposals: ${msg}`);
      console.error('[FastSync] Proposal fetch failed:', msg);
    }

    // ── Fetch votes for open proposals only ──────────────────────────────────

    if (openProposals.length > 0) {
      try {
        const votesMap = await fetchVotesForProposals(openProposals);
        const voteRows: Record<string, unknown>[] = [];

        for (const [drepId, votes] of Object.entries(votesMap)) {
          for (const vote of votes) {
            voteRows.push({
              vote_tx_hash: vote.vote_tx_hash,
              drep_id: drepId,
              proposal_tx_hash: vote.proposal_tx_hash,
              proposal_index: vote.proposal_index,
              vote: vote.vote,
              epoch_no: vote.epoch_no ?? (vote.block_time ? blockTimeToEpoch(vote.block_time) : null),
              block_time: vote.block_time,
              meta_url: vote.meta_url,
              meta_hash: vote.meta_hash,
            });
          }
        }

        const deduped = [...new Map(voteRows.map(r => [r.vote_tx_hash as string, r])).values()];

        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const batch = deduped.slice(i, i + BATCH_SIZE);
          await supabase.from('drep_votes')
            .upsert(batch, { onConflict: 'vote_tx_hash', ignoreDuplicates: false });
        }
        voteCount = deduped.length;
        voteOk = true;
        console.log(`[FastSync] Votes: ${voteCount} upserted for ${openProposals.length} open proposals`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Votes: ${msg}`);
        console.error('[FastSync] Vote fetch failed:', msg);
      }
    } else {
      voteOk = true;
    }

    // ── Refresh voting summaries (parallelized) ──────────────────────────────

    if (openProposals.length > 0) {
      try {
        const { data: openWithId } = await supabase.from('proposals')
          .select('tx_hash, proposal_index, proposal_id')
          .is('ratified_epoch', null).is('enacted_epoch', null)
          .is('dropped_epoch', null).is('expired_epoch', null)
          .not('proposal_id', 'is', null);

        const proposals = openWithId || [];
        let summaryCount = 0;

        for (let i = 0; i < proposals.length; i += SUMMARY_CONCURRENCY) {
          const chunk = proposals.slice(i, i + SUMMARY_CONCURRENCY);
          const results = await Promise.allSettled(
            chunk.map(async (p) => {
              const summary = await fetchProposalVotingSummary(p.proposal_id);
              if (!summary) return false;
              await supabase.from('proposal_voting_summary').upsert({
                proposal_tx_hash: p.tx_hash, proposal_index: p.proposal_index,
                epoch_no: summary.epoch_no,
                drep_yes_votes_cast: summary.drep_yes_votes_cast,
                drep_yes_vote_power: parseInt(summary.drep_active_yes_vote_power || '0', 10),
                drep_no_votes_cast: summary.drep_no_votes_cast,
                drep_no_vote_power: parseInt(summary.drep_active_no_vote_power || '0', 10),
                drep_abstain_votes_cast: summary.drep_abstain_votes_cast,
                drep_abstain_vote_power: parseInt(summary.drep_active_abstain_vote_power || '0', 10),
                drep_always_abstain_power: parseInt(summary.drep_always_abstain_vote_power || '0', 10),
                drep_always_no_confidence_power: parseInt(summary.drep_always_no_confidence_vote_power || '0', 10),
                pool_yes_votes_cast: summary.pool_yes_votes_cast,
                pool_yes_vote_power: parseInt(summary.pool_active_yes_vote_power || '0', 10),
                pool_no_votes_cast: summary.pool_no_votes_cast,
                pool_no_vote_power: parseInt(summary.pool_active_no_vote_power || '0', 10),
                pool_abstain_votes_cast: summary.pool_abstain_votes_cast,
                pool_abstain_vote_power: parseInt(summary.pool_active_abstain_vote_power || '0', 10),
                committee_yes_votes_cast: summary.committee_yes_votes_cast,
                committee_no_votes_cast: summary.committee_no_votes_cast,
                committee_abstain_votes_cast: summary.committee_abstain_votes_cast,
                fetched_at: new Date().toISOString(),
              }, { onConflict: 'proposal_tx_hash,proposal_index' });
              return true;
            })
          );
          summaryCount += results.filter(r => r.status === 'fulfilled' && r.value).length;
        }
        if (summaryCount > 0) console.log(`[FastSync] Voting summaries: ${summaryCount} refreshed`);
      } catch (err) {
        console.warn('[FastSync] Voting summary refresh error:', err instanceof Error ? err.message : err);
      }
    }

    // ── Push notifications for critical proposals ────────────────────────────

    try {
      if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        const { getProposalPriority } = await import('@/utils/proposalPriority');
        const { data: openCritical } = await supabase.from('proposals')
          .select('tx_hash, proposal_index, title, proposal_type')
          .is('ratified_epoch', null).is('enacted_epoch', null)
          .is('dropped_epoch', null).is('expired_epoch', null);

        const critical = (openCritical || []).filter(
          (p: Record<string, unknown>) => getProposalPriority(p.proposal_type as string) === 'critical'
        );

        if (critical.length > 0) {
          const newest = critical[0];
          const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
          const pushRes = await fetch(`${baseUrl}/api/push/send`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'critical-proposal-open', proposalTitle: newest.title, txHash: newest.tx_hash, index: newest.proposal_index }),
          });
          if (pushRes.ok) {
            const data = await pushRes.json();
            pushSent = data.sent || 0;
          }
        }
      }
    } catch (err) {
      console.warn('[FastSync] Push skipped:', err);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Unhandled: ${msg}`);
    console.error('[FastSync] Unhandled error:', msg);
  } finally {
    const durationMs = Date.now() - startTime;
    const duration = (durationMs / 1000).toFixed(1);
    const success = proposalOk && voteOk && errors.length === 0;

    console.log(`[FastSync] Complete in ${duration}s — ${proposalCount} proposals, ${voteCount} votes${pushSent > 0 ? `, ${pushSent} push` : ''}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`);

    const metrics = { proposals_synced: proposalCount, votes_synced: voteCount, push_sent: pushSent };

    if (syncLogId) {
      try {
        await supabase.from('sync_log').update({
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          success,
          error_message: errors.length > 0 ? errors.join('; ') : null,
          metrics,
        }).eq('id', syncLogId);
      } catch { /* best-effort */ }
    }

    try {
      const { captureServerEvent } = await import('@/lib/posthog-server');
      captureServerEvent(success ? 'sync_completed' : 'sync_failed', { sync_type: 'fast', duration_ms: durationMs, ...metrics });
    } catch { /* posthog optional */ }

    return NextResponse.json({
      success,
      proposals: proposalCount,
      votes: voteCount,
      pushSent,
      errors: errors.length > 0 ? errors : undefined,
      durationSeconds: duration,
      timestamp: new Date().toISOString(),
    }, { status: success ? 200 : 207 });
  }
}
