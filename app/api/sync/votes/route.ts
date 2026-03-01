import { NextRequest, NextResponse } from 'next/server';
import { DRepVote } from '@/types/koios';
import { blockTimeToEpoch } from '@/lib/koios';
import { fetchAllVotesBulk, resetKoiosMetrics, getKoiosMetrics } from '@/utils/koios';
import {
  authorizeCron,
  initSupabase,
  SyncLogger,
  batchUpsert,
  errMsg,
  emitPostHog,
  triggerAnalyticsDeploy,
  alertDiscord,
} from '@/lib/sync-utils';
import { KoiosVoteListSchema, validateArray } from '@/utils/koios-schemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface SupabaseVoteRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  epoch_no: number | null;
  block_time: number;
  meta_url: string | null;
  meta_hash: string | null;
}

export async function GET(request: NextRequest) {
  const authError = authorizeCron(request);
  if (authError) return authError;

  const init = initSupabase();
  if ('error' in init) return init.error;
  const { supabase } = init;

  const logger = new SyncLogger(supabase, 'votes');
  await logger.start();
  resetKoiosMetrics();

  let votesSynced = 0;
  let reconciled = 0;

  try {
    // ── Step 1: Fetch all votes in bulk ─────────────────────────────────────

    let bulkVotesMap: Record<string, DRepVote[]>;
    try {
      bulkVotesMap = await fetchAllVotesBulk();
      const totalVotes = Object.values(bulkVotesMap).reduce((sum, v) => sum + v.length, 0);
      console.log(`[VoteSync] Bulk votes fetched: ${totalVotes} votes across ${Object.keys(bulkVotesMap).length} DReps`);
    } catch (err) {
      const msg = errMsg(err);
      console.error('[VoteSync] fetchAllVotesBulk failed:', msg);
      await logger.finalize(false, msg, {});
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }

    // ── Step 2: Build vote rows and upsert ──────────────────────────────────

    const voteRows: SupabaseVoteRow[] = [];
    for (const [drepId, votes] of Object.entries(bulkVotesMap)) {
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

    const dedupedVoteRows = [...new Map(voteRows.map(r => [r.vote_tx_hash, r])).values()];
    let validationErrors = 0;

    const { valid: validatedVotes, invalidCount } = validateArray(dedupedVoteRows, KoiosVoteListSchema, 'votes');
    validationErrors = invalidCount;
    if (invalidCount > 0) {
      emitPostHog(true, 'votes', 0, { event_override: 'sync_validation_error', record_type: 'vote', invalid_count: invalidCount });
      alertDiscord('Validation Errors: votes', `${invalidCount} vote records failed Zod validation`);
    }

    if (validatedVotes.length > 0) {
      const result = await batchUpsert(
        supabase,
        'drep_votes',
        validatedVotes as unknown as Record<string, unknown>[],
        'vote_tx_hash',
        'Votes',
      );
      votesSynced = result.success;
      console.log(`[VoteSync] Upserted ${result.success} votes (${result.errors} errors)`);
    }

    // ── Step 3: Vote count reconciliation ───────────────────────────────────

    const drepIds = Object.keys(bulkVotesMap);

    const computedCounts = new Map<string, { yes: number; no: number; abstain: number; total: number }>();
    for (const drepId of drepIds) {
      const votes = bulkVotesMap[drepId];
      const latestByProposal = new Map<string, { vote: string; block_time: number }>();
      for (const v of votes) {
        const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
        const cur = latestByProposal.get(key);
        if (!cur || v.block_time > cur.block_time) {
          latestByProposal.set(key, { vote: v.vote, block_time: v.block_time });
        }
      }
      const deduped = [...latestByProposal.values()];
      computedCounts.set(drepId, {
        yes: deduped.filter(v => v.vote === 'Yes').length,
        no: deduped.filter(v => v.vote === 'No').length,
        abstain: deduped.filter(v => v.vote === 'Abstain').length,
        total: deduped.length,
      });
    }

    const allCurrentInfo = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < drepIds.length; i += 1000) {
      const { data } = await supabase
        .from('dreps')
        .select('id, info')
        .in('id', drepIds.slice(i, i + 1000));
      for (const row of data || []) {
        if (row.info) allCurrentInfo.set(row.id, row.info as Record<string, unknown>);
      }
    }

    for (const [drepId, counts] of computedCounts) {
      const info = allCurrentInfo.get(drepId);
      if (!info) continue;
      if (
        info.totalVotes === counts.total &&
        info.yesVotes === counts.yes &&
        info.noVotes === counts.no &&
        info.abstainVotes === counts.abstain
      ) continue;

      await supabase.from('dreps').update({
        info: {
          ...info,
          totalVotes: counts.total,
          yesVotes: counts.yes,
          noVotes: counts.no,
          abstainVotes: counts.abstain,
        },
      }).eq('id', drepId);
      reconciled++;
    }

    if (reconciled > 0) {
      console.log(`[VoteSync] Vote count reconciliation: ${reconciled} DReps updated`);
    }

    // ── Finalize ────────────────────────────────────────────────────────────

    const metrics = { votes_synced: votesSynced, reconciled, validation_errors: validationErrors, ...getKoiosMetrics() };
    await logger.finalize(true, null, metrics);
    await emitPostHog(true, 'votes', logger.elapsed, metrics);
    triggerAnalyticsDeploy('votes'); // fire-and-forget

    return NextResponse.json({
      success: true,
      votesSynced,
      reconciled,
      durationSeconds: (logger.elapsed / 1000).toFixed(1),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = errMsg(err);
    console.error('[VoteSync] Fatal error:', msg);
    const metrics = { votes_synced: votesSynced, reconciled };
    await logger.finalize(false, msg, metrics);
    await emitPostHog(false, 'votes', logger.elapsed, metrics);

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
