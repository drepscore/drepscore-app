/**
 * Full DRep Sync — runs daily at 2 AM via Vercel Pro cron.
 * Pulls all DRep data, votes (bulk), proposals, rationales, AI summaries,
 * delegator counts, power snapshots, alignment scores, score history,
 * and social link checks.
 *
 * Auth: GET /api/sync?secret=<CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnrichedDReps, blockTimeToEpoch } from '@/lib/koios';
import {
  fetchProposals,
  fetchDRepDelegatorCount,
  fetchDRepVotingPowerHistory,
  fetchAllVotesBulk,
  fetchProposalVotingSummary,
  fetchDRepInfo,
} from '@/utils/koios';
import { DRepVote } from '@/types/koios';
import { blake2bHex } from 'blakejs';
import { classifyProposals, computeAllCategoryScores } from '@/lib/alignment';
import type { ClassifiedProposal } from '@/types/koios';
import type { ProposalContext } from '@/utils/scoring';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function truncateToWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
}

interface SupabaseDRepRow {
  id: string;
  metadata: Record<string, unknown>;
  info: Record<string, unknown>;
  votes: unknown[];
  score: number;
  participation_rate: number;
  rationale_rate: number;
  reliability_score: number;
  reliability_streak: number;
  reliability_recency: number;
  reliability_longest_gap: number;
  reliability_tenure: number;
  deliberation_modifier: number;
  effective_participation: number;
  size_tier: string;
  profile_completeness: number;
  anchor_url: string | null;
  anchor_hash: string | null;
}

interface SupabaseProposalRow {
  tx_hash: string;
  proposal_index: number;
  proposal_id: string;
  proposal_type: string;
  title: string;
  abstract: string | null;
  withdrawal_amount: number | null;
  treasury_tier: string | null;
  param_changes: Record<string, unknown> | null;
  relevant_prefs: string[];
  proposed_epoch: number;
  block_time: number;
  expired_epoch: number | null;
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expiration_epoch: number | null;
}

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

interface SupabaseRationaleRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  meta_url: string | null;
  rationale_text: string | null;
}

const BATCH_SIZE = 100;
const RATIONALE_FETCH_TIMEOUT_MS = 5000;
const RATIONALE_MAX_CONTENT_SIZE = 50000;
const RATIONALE_CONCURRENCY = 8;
const RATIONALE_MAX_PER_SYNC = 200;
const DELEGATOR_CONCURRENCY = 20;

// ── Rationale Helpers ─────────────────────────────────────────────────────────

function extractJsonLdString(val: unknown): string | null {
  if (typeof val === 'string') return val.trim() || null;
  if (val && typeof val === 'object' && '@value' in (val as Record<string, unknown>)) {
    const v = (val as Record<string, unknown>)['@value'];
    if (typeof v === 'string') return v.trim() || null;
  }
  if (Array.isArray(val) && val.length > 0) return extractJsonLdString(val[0]);
  return null;
}

async function fetchRationaleFromUrl(url: string): Promise<string | null> {
  try {
    let fetchUrl = url;
    if (url.startsWith('ipfs://')) {
      fetchUrl = `https://ipfs.io/ipfs/${url.slice(7)}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RATIONALE_FETCH_TIMEOUT_MS);

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain, */*' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > RATIONALE_MAX_CONTENT_SIZE) return null;

    const text = await response.text();
    if (text.length > RATIONALE_MAX_CONTENT_SIZE) return null;

    try {
      const json = JSON.parse(text);

      if (json.body && typeof json.body === 'object') {
        for (const key of ['comment', 'rationale', 'motivation']) {
          const extracted = extractJsonLdString(json.body[key]);
          if (extracted) return extracted;
        }
      }

      for (const key of ['rationale', 'motivation', 'justification', 'reason', 'comment']) {
        const extracted = extractJsonLdString(json[key]);
        if (extracted) return extracted;
      }

      if (typeof json === 'string' && json.trim()) return json.trim();
    } catch {
      if (text.trim() && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
        return text.trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchAndCacheRationales(
  allVotes: { drepId: string; vote: DRepVote }[],
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ fetched: number; cached: number }> {
  const votesNeedingFetch = allVotes.filter(
    v => v.vote.meta_url
      && !v.vote.meta_json?.rationale
      && !v.vote.meta_json?.body?.comment
      && !v.vote.meta_json?.body?.rationale
  );

  if (votesNeedingFetch.length === 0) return { fetched: 0, cached: 0 };

  const txHashes = votesNeedingFetch.map(v => v.vote.vote_tx_hash);
  const { data: existingRows } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash')
    .in('vote_tx_hash', txHashes.slice(0, 1000))
    .not('rationale_text', 'is', null);

  const alreadyCached = new Set((existingRows || []).map(r => r.vote_tx_hash));
  const allUncached = votesNeedingFetch.filter(v => !alreadyCached.has(v.vote.vote_tx_hash));
  const uncached = allUncached.slice(0, RATIONALE_MAX_PER_SYNC);

  if (uncached.length === 0) return { fetched: 0, cached: alreadyCached.size };
  if (allUncached.length > RATIONALE_MAX_PER_SYNC) {
    console.log(`[Sync] Rationale fetch capped at ${RATIONALE_MAX_PER_SYNC}/${allUncached.length} uncached`);
  }

  console.log(`[Sync] Fetching rationales for ${uncached.length} uncached votes...`);

  const rationaleRows: SupabaseRationaleRow[] = [];

  for (let i = 0; i < uncached.length; i += RATIONALE_CONCURRENCY) {
    const chunk = uncached.slice(i, i + RATIONALE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async ({ drepId, vote }) => {
        const text = await fetchRationaleFromUrl(vote.meta_url!);
        return {
          vote_tx_hash: vote.vote_tx_hash,
          drep_id: drepId,
          proposal_tx_hash: vote.proposal_tx_hash,
          proposal_index: vote.proposal_index,
          meta_url: vote.meta_url,
          rationale_text: text,
        };
      })
    );
    rationaleRows.push(...results);
  }

  const successRows = rationaleRows.filter(r => r.rationale_text !== null);
  console.log(`[Sync] Rationale URL fetch: ${successRows.length} succeeded, ${rationaleRows.length - successRows.length} failed`);

  if (successRows.length > 0) {
    for (let i = 0; i < successRows.length; i += BATCH_SIZE) {
      const batch = successRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('vote_rationales')
        .upsert(batch, { onConflict: 'vote_tx_hash' });
      if (error) console.error(`[Sync] Rationale upsert error:`, error.message);
    }
  }

  return { fetched: successRows.length, cached: alreadyCached.size };
}

// ── Batched Supabase upsert helper ────────────────────────────────────────────

async function batchUpsert<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  rows: T[],
  onConflict: string,
  label: string
): Promise<{ success: number; errors: number }> {
  let success = 0, errors = 0;
  const total = Math.ceil(rows.length / BATCH_SIZE);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: false });
    if (error) {
      console.error(`[Sync] ${label} batch error:`, error.message);
      errors += batch.length;
    } else {
      success += batch.length;
    }
  }
  if (total > 1) console.log(`[Sync] ${label}: ${success} ok, ${errors} errors (${total} batches)`);
  return { success, errors };
}

// ── Main Sync Handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET not set' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ success: false, error: `Supabase init failed: ${msg}` }, { status: 500 });
  }

  console.log('[Sync] Starting full daily sync...');

  // Write sync_log start record
  let syncLogId: number | null = null;
  try {
    const { data: logRow } = await supabase.from('sync_log')
      .insert({ sync_type: 'full', started_at: new Date().toISOString(), success: false })
      .select('id').single();
    syncLogId = logRow?.id ?? null;
  } catch { /* sync_log write is best-effort */ }

  async function finalizeSyncLog(success: boolean, errorMessage: string | null, metrics: Record<string, unknown>) {
    if (!syncLogId) return;
    try {
      await supabase.from('sync_log').update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        success,
        error_message: errorMessage,
        metrics,
      }).eq('id', syncLogId);
    } catch { /* best-effort */ }
  }

  const syncErrors: string[] = [];

  // ═══ PHASE 1: Parallel Koios fetches ═══════════════════════════════════════
  // Fetch proposals + bulk votes in parallel (the two heaviest API calls)

  let classifiedProposalsList: ClassifiedProposal[] = [];
  const proposalContextMap = new Map<string, ProposalContext>();
  let bulkVotesMap: Record<string, DRepVote[]> = {};

  const [proposalsResult, votesResult] = await Promise.allSettled([
    fetchProposals().then(raw => {
      if (raw.length > 0) {
        classifiedProposalsList = classifyProposals(raw);
        for (const p of classifiedProposalsList) {
          proposalContextMap.set(`${p.txHash}-${p.index}`, {
            proposalType: p.type,
            treasuryTier: p.treasuryTier,
          });
        }
      }
      console.log(`[Sync] Proposals fetched: ${raw.length}, classified: ${classifiedProposalsList.length}`);
    }),
    fetchAllVotesBulk().then(votes => {
      bulkVotesMap = votes;
      const totalVotes = Object.values(votes).reduce((sum, v) => sum + v.length, 0);
      console.log(`[Sync] Bulk votes fetched: ${totalVotes} votes across ${Object.keys(votes).length} DReps`);
    }),
  ]);

  if (proposalsResult.status === 'rejected') {
    const msg = String(proposalsResult.reason);
    syncErrors.push(`Proposals: ${msg}`);
    console.warn('[Sync] Proposal fetch failed:', msg);
  }
  if (votesResult.status === 'rejected') {
    const msg = String(votesResult.reason);
    syncErrors.push(`Bulk votes: ${msg}`);
    console.warn('[Sync] Bulk vote fetch failed, falling back to per-DRep:', msg);
  }

  // ═══ PHASE 2: Enrich DReps (uses pre-fetched votes) ═══════════════════════

  let allDReps;
  let rawVotesMap: Record<string, DRepVote[]> | undefined;

  try {
    const hasBulkVotes = Object.keys(bulkVotesMap).length > 0;
    const result = await getEnrichedDReps(false, {
      includeRawVotes: true,
      proposalContextMap: proposalContextMap.size > 0 ? proposalContextMap : undefined,
      ...(hasBulkVotes ? { prefetchedVotes: bulkVotesMap } : {}),
    });

    if (result.error || !result.allDReps?.length) {
      const errMsg = 'Koios DRep fetch returned no data';
      syncErrors.push(errMsg);
      await finalizeSyncLog(false, syncErrors.join('; '), {});
      return NextResponse.json({ success: false, error: errMsg }, { status: 502 });
    }

    allDReps = result.allDReps;
    rawVotesMap = result.rawVotesMap as Record<string, DRepVote[]> | undefined;
    console.log(`[Sync] Enriched ${allDReps.length} DReps`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    syncErrors.push(`DRep enrichment: ${msg}`);
    await finalizeSyncLog(false, syncErrors.join('; '), {});
    return NextResponse.json({ success: false, error: `DRep enrichment failed: ${msg}` }, { status: 500 });
  }

  // ═══ PHASE 3: Parallel upserts (DReps + Votes + Proposals) ════════════════

  const drepRows: SupabaseDRepRow[] = allDReps.map((drep) => ({
    id: drep.drepId,
    metadata: (drep.metadata as Record<string, unknown>) || {},
    info: {
      drepHash: drep.drepHash, handle: drep.handle, name: drep.name,
      ticker: drep.ticker, description: drep.description,
      votingPower: drep.votingPower, votingPowerLovelace: drep.votingPowerLovelace,
      delegatorCount: drep.delegatorCount, totalVotes: drep.totalVotes,
      yesVotes: drep.yesVotes, noVotes: drep.noVotes, abstainVotes: drep.abstainVotes,
      isActive: drep.isActive, anchorUrl: drep.anchorUrl,
      epochVoteCounts: drep.epochVoteCounts,
    },
    votes: [],
    score: drep.drepScore, participation_rate: drep.participationRate,
    rationale_rate: drep.rationaleRate, reliability_score: drep.reliabilityScore,
    reliability_streak: drep.reliabilityStreak, reliability_recency: drep.reliabilityRecency,
    reliability_longest_gap: drep.reliabilityLongestGap, reliability_tenure: drep.reliabilityTenure,
    deliberation_modifier: drep.deliberationModifier,
    effective_participation: drep.effectiveParticipation,
    size_tier: drep.sizeTier, profile_completeness: drep.profileCompleteness,
    anchor_url: drep.anchorUrl || null,
    anchor_hash: drep.anchorHash || null,
  }));

  // FIX: Upsert ALL votes from bulkVotesMap directly (not just those from enriched DReps)
  // This ensures votes from deregistered/filtered DReps aren't silently dropped.
  const voteRows: SupabaseVoteRow[] = [];
  const allVotesForRationale: { drepId: string; vote: DRepVote }[] = [];

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
      allVotesForRationale.push({ drepId, vote });
    }
  }

  const dedupedVoteRows = [...new Map(voteRows.map(r => [r.vote_tx_hash, r])).values()];

  const proposalRows: SupabaseProposalRow[] = classifiedProposalsList.length > 0
    ? [...new Map(
        classifiedProposalsList.map(p => [`${p.txHash}-${p.index}`, {
          tx_hash: p.txHash, proposal_index: p.index, proposal_id: p.proposalId,
          proposal_type: p.type, title: p.title, abstract: p.abstract,
          withdrawal_amount: p.withdrawalAmountAda, treasury_tier: p.treasuryTier,
          param_changes: p.paramChanges, relevant_prefs: p.relevantPrefs,
          proposed_epoch: p.proposedEpoch, block_time: p.blockTime,
          expired_epoch: p.expiredEpoch, ratified_epoch: p.ratifiedEpoch,
          enacted_epoch: p.enactedEpoch, dropped_epoch: p.droppedEpoch,
          expiration_epoch: p.expirationEpoch,
        } as SupabaseProposalRow])
      ).values()]
    : [];

  console.log(`[Sync] Upserting ${drepRows.length} DReps, ${dedupedVoteRows.length} votes, ${proposalRows.length} proposals in parallel...`);

  const [drepResult, voteResult, proposalResult] = await Promise.all([
    batchUpsert(supabase, 'dreps', drepRows as unknown as Record<string, unknown>[], 'id', 'DReps'),
    dedupedVoteRows.length > 0
      ? batchUpsert(supabase, 'drep_votes', dedupedVoteRows as unknown as Record<string, unknown>[], 'vote_tx_hash', 'Votes')
      : Promise.resolve({ success: 0, errors: 0 }),
    proposalRows.length > 0
      ? batchUpsert(supabase, 'proposals', proposalRows as unknown as Record<string, unknown>[], 'tx_hash,proposal_index', 'Proposals')
      : Promise.resolve({ success: 0, errors: 0 }),
  ]);

  // ═══ PHASE 4: Parallel secondary operations ═══════════════════════════════
  // Delegator counts, power snapshots, alignment scores, score history

  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  const phase4Results = await Promise.allSettled([
    // Delegator counts: batch read + diff + bulk update
    (async () => {
      const { data: currentDreps } = await supabase
        .from('dreps')
        .select('id, info')
        .in('id', allDReps.map(d => d.drepId).slice(0, 1000));

      const currentCounts = new Map<string, number>();
      for (const row of currentDreps || []) {
        const info = row.info as Record<string, unknown> | null;
        currentCounts.set(row.id, (info?.delegatorCount as number) || 0);
      }

      const newCounts: { id: string; count: number }[] = [];
      for (let i = 0; i < allDReps.length; i += DELEGATOR_CONCURRENCY) {
        const batch = allDReps.slice(i, i + DELEGATOR_CONCURRENCY);
        const counts = await Promise.all(batch.map(d => fetchDRepDelegatorCount(d.drepId)));
        for (let j = 0; j < batch.length; j++) {
          newCounts.push({ id: batch[j].drepId, count: counts[j] });
        }
      }

      const changed = newCounts.filter(n => n.count > 0 && n.count !== currentCounts.get(n.id));
      if (changed.length > 0) {
        for (const { id, count } of changed) {
          const existing = currentDreps?.find(r => r.id === id);
          if (existing?.info) {
            await supabase.from('dreps')
              .update({ info: { ...(existing.info as Record<string, unknown>), delegatorCount: count } })
              .eq('id', id);
          }
        }
      }
      console.log(`[Sync] Delegator counts: ${changed.length} changed out of ${newCounts.length}`);
    })(),

    // Power snapshots
    (async () => {
      const powerRows = allDReps
        .filter(d => d.votingPowerLovelace && d.votingPowerLovelace !== '0')
        .map(d => ({
          drep_id: d.drepId,
          epoch_no: currentEpoch,
          amount_lovelace: parseInt(d.votingPowerLovelace, 10) || 0,
        }));
      if (powerRows.length > 0) {
        for (let i = 0; i < powerRows.length; i += BATCH_SIZE) {
          await supabase.from('drep_power_snapshots')
            .upsert(powerRows.slice(i, i + BATCH_SIZE), { onConflict: 'drep_id,epoch_no', ignoreDuplicates: true });
        }
        console.log(`[Sync] Power snapshots: ${powerRows.length} rows for epoch ${currentEpoch}`);
      }
    })(),

    // Alignment scores
    (async () => {
      if (!rawVotesMap || classifiedProposalsList.length === 0) return;
      const updates = allDReps.map(drep => {
        const votes = rawVotesMap![drep.drepId] || [];
        const scores = computeAllCategoryScores(drep, votes, classifiedProposalsList);
        return {
          id: drep.drepId,
          alignment_treasury_conservative: scores.alignmentTreasuryConservative,
          alignment_treasury_growth: scores.alignmentTreasuryGrowth,
          alignment_decentralization: scores.alignmentDecentralization,
          alignment_security: scores.alignmentSecurity,
          alignment_innovation: scores.alignmentInnovation,
          alignment_transparency: scores.alignmentTransparency,
          last_vote_time: scores.lastVoteTime,
        };
      });
      const r = await batchUpsert(supabase, 'dreps', updates as unknown as Record<string, unknown>[], 'id', 'Alignment');
      console.log(`[Sync] Alignment scores: ${r.success} computed`);
    })(),

    // Score history
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const historyRows = allDReps.map(drep => ({
        drep_id: drep.drepId, score: drep.drepScore,
        effective_participation: drep.effectiveParticipation,
        rationale_rate: drep.rationaleRate,
        reliability_score: drep.reliabilityScore,
        profile_completeness: drep.profileCompleteness,
        snapshot_date: today,
      }));
      const r = await batchUpsert(supabase, 'drep_score_history', historyRows as unknown as Record<string, unknown>[], 'drep_id,snapshot_date', 'Score history');
      if (r.success > 0) console.log(`[Sync] Score history: ${r.success} snapshots for ${today}`);
    })(),
  ]);

  for (const r of phase4Results) {
    if (r.status === 'rejected') console.error('[Sync] Phase 4 error:', r.reason);
  }

  // ═══ PHASE 5: Parallel slow operations ════════════════════════════════════
  // Rationale fetching, AI summaries, social link checks, vote power backfill

  const phase5Results = await Promise.allSettled([
    // Rationale pipeline: inline + URL-based
    (async () => {
      if (!rawVotesMap) return;

      const inlineRationales: SupabaseRationaleRow[] = [];
      for (const { drepId, vote } of allVotesForRationale) {
        const text = vote.meta_json?.body?.comment || vote.meta_json?.body?.rationale || vote.meta_json?.rationale;
        if (text && typeof text === 'string') {
          inlineRationales.push({
            vote_tx_hash: vote.vote_tx_hash, drep_id: drepId,
            proposal_tx_hash: vote.proposal_tx_hash, proposal_index: vote.proposal_index,
            meta_url: vote.meta_url, rationale_text: text,
          });
        }
      }

      if (inlineRationales.length > 0) {
        for (let i = 0; i < inlineRationales.length; i += BATCH_SIZE) {
          await supabase.from('vote_rationales')
            .upsert(inlineRationales.slice(i, i + BATCH_SIZE), { onConflict: 'vote_tx_hash' });
        }
        console.log(`[Sync] Inline rationales: ${inlineRationales.length}`);
      }

      await supabase.from('vote_rationales').delete().is('rationale_text', null);

      const result = await fetchAndCacheRationales(allVotesForRationale, supabase);
      console.log(`[Sync] Rationales: ${result.fetched} new, ${result.cached} cached`);
    })(),

    // AI summaries (proposals + rationales)
    (async () => {
      if (!process.env.ANTHROPIC_API_KEY) return;

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      let proposalSummaries = 0, rationaleSummaries = 0;

      // Proposal summaries
      const { data: unsummarized } = await supabase.from('proposals')
        .select('tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount')
        .is('ai_summary', null).not('abstract', 'is', null).neq('abstract', '').limit(10);

      for (const row of unsummarized || []) {
        try {
          const amountCtx = row.withdrawal_amount ? `\nWithdrawal Amount: ${Number(row.withdrawal_amount).toLocaleString()} ADA` : '';
          const msg = await anthropic.messages.create({
            model: 'claude-sonnet-4-5', max_tokens: 80,
            messages: [{ role: 'user', content: `Summarize this Cardano governance proposal in 1-2 short sentences for a casual ADA holder. Plain language, no jargon. Neutral tone. No URLs or hashes. Your entire response must be 160 characters or fewer.\n\nTitle: ${row.title || 'Untitled'}\nType: ${row.proposal_type}${amountCtx}\nDescription: ${(row.abstract || '').slice(0, 2000)}` }],
          });
          const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
          const summary = raw ? truncateToWordBoundary(raw.replace(/https?:\/\/\S+/g, '').replace(/ipfs:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim(), 160) : null;
          if (summary) {
            await supabase.from('proposals').update({ ai_summary: summary })
              .eq('tx_hash', row.tx_hash).eq('proposal_index', row.proposal_index);
            proposalSummaries++;
          }
        } catch (e) { console.error(`[Sync] AI proposal summary error:`, e); }
      }

      // Rationale summaries
      const { data: unsumRationales } = await supabase.from('vote_rationales')
        .select('vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, rationale_text')
        .is('ai_summary', null).not('rationale_text', 'is', null).neq('rationale_text', '').limit(20);

      if (unsumRationales?.length) {
        const txHashes = [...new Set(unsumRationales.map(r => r.proposal_tx_hash))];
        const { data: pRows } = await supabase.from('proposals').select('tx_hash, proposal_index, title').in('tx_hash', txHashes);
        const titles = new Map<string, string>();
        for (const p of pRows || []) titles.set(`${p.tx_hash}-${p.proposal_index}`, p.title || 'Untitled');

        const vtxs = unsumRationales.map(r => r.vote_tx_hash);
        const { data: vRows } = await supabase.from('drep_votes').select('vote_tx_hash, vote').in('vote_tx_hash', vtxs);
        const dirs = new Map<string, string>();
        for (const v of vRows || []) dirs.set(v.vote_tx_hash, v.vote);

        for (const row of unsumRationales) {
          try {
            const title = titles.get(`${row.proposal_tx_hash}-${row.proposal_index}`) || 'this proposal';
            const dir = dirs.get(row.vote_tx_hash) || 'voted';
            const msg = await anthropic.messages.create({
              model: 'claude-sonnet-4-5', max_tokens: 80,
              messages: [{ role: 'user', content: `Summarize this DRep's rationale for voting ${dir} on "${title}" in 1-2 neutral sentences. Plain language, no editorializing. No URLs or hashes. Your entire response must be 160 characters or fewer.\n\nRationale: ${(row.rationale_text || '').slice(0, 1500)}` }],
            });
            const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
            const summary = raw ? truncateToWordBoundary(raw.replace(/https?:\/\/\S+/g, '').replace(/ipfs:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim(), 160) : null;
            if (summary) {
              await supabase.from('vote_rationales').update({ ai_summary: summary }).eq('vote_tx_hash', row.vote_tx_hash);
              rationaleSummaries++;
            }
          } catch (e) { console.error(`[Sync] AI rationale summary error:`, e); }
        }
      }

      console.log(`[Sync] AI summaries: ${proposalSummaries} proposals, ${rationaleSummaries} rationales`);
    })(),

    // Social link checks
    (async () => {
      const LINK_CHECK_LIMIT = 50;
      const staleThreshold = new Date(Date.now() - 14 * 86400000).toISOString();

      const allLinks: { drep_id: string; uri: string }[] = [];
      const seen = new Set<string>();
      for (const drep of allDReps) {
        const refs = drep.metadata?.references;
        if (!Array.isArray(refs)) continue;
        for (const ref of refs) {
          if (ref && typeof ref === 'object' && 'uri' in ref) {
            const uri = (ref as { uri: unknown }).uri;
            if (typeof uri === 'string' && uri.startsWith('http')) {
              const key = `${drep.drepId}|${uri}`;
              if (seen.has(key)) continue;
              seen.add(key);
              allLinks.push({ drep_id: drep.drepId, uri });
            }
          }
        }
      }

      if (allLinks.length === 0) return;

      const { data: existing } = await supabase.from('social_link_checks')
        .select('drep_id, uri, last_checked_at').in('uri', allLinks.map(l => l.uri).slice(0, 500));

      const freshSet = new Set<string>();
      for (const row of existing || []) {
        if (row.last_checked_at && row.last_checked_at > staleThreshold) freshSet.add(`${row.drep_id}|${row.uri}`);
      }

      const toCheck = allLinks.filter(l => !freshSet.has(`${l.drep_id}|${l.uri}`)).slice(0, LINK_CHECK_LIMIT);
      let checked = 0;

      for (const link of toCheck) {
        let status = 'broken';
        let httpStatus: number | null = null;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(link.uri, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'DRepScore-LinkChecker/1.0' } });
          clearTimeout(timeout);
          httpStatus = res.status;
          status = res.ok ? 'valid' : 'broken';
        } catch { /* stays broken */ }

        await supabase.from('social_link_checks').upsert({
          drep_id: link.drep_id, uri: link.uri, status, http_status: httpStatus,
          last_checked_at: new Date().toISOString(),
        }, { onConflict: 'drep_id,uri' });
        checked++;
      }

      if (checked > 0) console.log(`[Sync] Social links: ${checked} checked`);
    })(),

    // Two-tier vote power backfill (exact match + nearest epoch)
    (async () => {
      const drepSet = new Set<string>();
      let bfOffset = 0;
      while (true) {
        const { data } = await supabase.from('drep_votes')
          .select('drep_id').is('voting_power_lovelace', null)
          .range(bfOffset, bfOffset + 999);
        if (!data || data.length === 0) break;
        for (const r of data) drepSet.add(r.drep_id);
        if (data.length < 1000) break;
        bfOffset += 1000;
      }

      const uniqueIds = [...drepSet];
      if (uniqueIds.length === 0) {
        console.log('[Sync] Vote power backfill: complete (no NULL rows)');
        return;
      }

      console.log(`[Sync] Backfilling voting power for ${uniqueIds.length} DReps (processing 50)...`);
      let exactCount = 0, nearestCount = 0;

      for (const drepId of uniqueIds.slice(0, 50)) {
        try {
          const history = await fetchDRepVotingPowerHistory(drepId);
          if (history.length === 0) continue;

          const snapRows = history.map(h => ({
            drep_id: drepId, epoch_no: h.epoch_no,
            amount_lovelace: parseInt(h.amount, 10) || 0,
          }));
          await supabase.from('drep_power_snapshots')
            .upsert(snapRows, { onConflict: 'drep_id,epoch_no', ignoreDuplicates: true });

          const historyEpochs = new Set(history.map(h => h.epoch_no));

          // Tier 1: exact epoch match
          for (const snap of snapRows) {
            const { count } = await supabase.from('drep_votes')
              .update({ voting_power_lovelace: snap.amount_lovelace, power_source: 'exact' }, { count: 'exact' })
              .eq('drep_id', drepId).eq('epoch_no', snap.epoch_no)
              .is('voting_power_lovelace', null);
            exactCount += (count || 0);
          }

          // Tier 2: nearest epoch for remaining NULL votes from this DRep
          const { data: remaining } = await supabase.from('drep_votes')
            .select('vote_tx_hash, epoch_no')
            .eq('drep_id', drepId).is('voting_power_lovelace', null)
            .not('epoch_no', 'is', null);
          for (const vote of remaining || []) {
            if (historyEpochs.has(vote.epoch_no)) continue;
            const nearest = history.reduce((best, h) =>
              Math.abs(h.epoch_no - vote.epoch_no) < Math.abs(best.epoch_no - vote.epoch_no) ? h : best
            );
            await supabase.from('drep_votes')
              .update({ voting_power_lovelace: parseInt(nearest.amount, 10), power_source: 'nearest' })
              .eq('vote_tx_hash', vote.vote_tx_hash);
            nearestCount++;
          }
        } catch (err) {
          console.warn(`[Sync] Power backfill error for ${drepId.slice(0, 20)}:`, err instanceof Error ? err.message : err);
        }
      }
      console.log(`[Sync] Power backfill: ${exactCount} exact, ${nearestCount} nearest`);
    })(),

    // Proposal voting summaries (canonical tallies)
    (async () => {
      const { data: openProposals } = await supabase.from('proposals')
        .select('tx_hash, proposal_index, proposal_id')
        .is('ratified_epoch', null).is('enacted_epoch', null)
        .is('dropped_epoch', null).is('expired_epoch', null)
        .not('proposal_id', 'is', null);

      if (!openProposals?.length) return;

      let synced = 0;
      for (const p of openProposals) {
        try {
          const summary = await fetchProposalVotingSummary(p.proposal_id);
          if (!summary) continue;
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
          synced++;
        } catch (err) {
          console.warn(`[Sync] Voting summary error:`, err instanceof Error ? err.message : err);
        }
      }
      console.log(`[Sync] Proposal voting summaries: ${synced}/${openProposals.length} updated`);
    })(),

    // Hash verification for rationales (blake2b-256)
    (async () => {
      const { data: unchecked } = await supabase.from('vote_rationales')
        .select('vote_tx_hash, meta_url')
        .is('hash_verified', null)
        .not('meta_url', 'is', null)
        .limit(50);
      if (!unchecked?.length) return;

      const txHashes = unchecked.map(r => r.vote_tx_hash);
      const { data: voteHashes } = await supabase.from('drep_votes')
        .select('vote_tx_hash, meta_hash')
        .in('vote_tx_hash', txHashes)
        .not('meta_hash', 'is', null);

      const hashMap = new Map<string, string>();
      for (const v of voteHashes || []) hashMap.set(v.vote_tx_hash, v.meta_hash);

      let verified = 0, failed = 0, noHash = 0;
      for (const row of unchecked) {
        const expectedHash = hashMap.get(row.vote_tx_hash);
        if (!expectedHash) {
          noHash++;
          continue;
        }
        try {
          let fetchUrl = row.meta_url;
          if (fetchUrl.startsWith('ipfs://')) fetchUrl = `https://ipfs.io/ipfs/${fetchUrl.slice(7)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(fetchUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) continue;
          const rawBytes = new Uint8Array(await res.arrayBuffer());
          const computedHash = blake2bHex(rawBytes, undefined, 32);
          const matches = computedHash === expectedHash;
          await supabase.from('vote_rationales')
            .update({ hash_verified: matches })
            .eq('vote_tx_hash', row.vote_tx_hash);
          if (matches) verified++; else failed++;
        } catch { /* skip on error */ }
      }
      console.log(`[Sync] Hash verification: ${verified} verified, ${failed} mismatch, ${noHash} no hash`);
    })(),

    // Vote count reconciliation (derive from drep_votes table)
    (async () => {
      const drepIds = allDReps.map(d => d.drepId);
      const batchSize = 200;
      let reconciled = 0;

      for (let i = 0; i < drepIds.length; i += batchSize) {
        const batch = drepIds.slice(i, i + batchSize);
        for (const drepId of batch) {
          const { data: votes } = await supabase.from('drep_votes')
            .select('vote, proposal_tx_hash, proposal_index, block_time')
            .eq('drep_id', drepId);
          if (!votes?.length) continue;

          // Deduplicate by proposal (latest vote wins)
          const latestByProposal = new Map<string, { vote: string; block_time: number }>();
          for (const v of votes) {
            const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
            const existing = latestByProposal.get(key);
            if (!existing || v.block_time > existing.block_time) {
              latestByProposal.set(key, { vote: v.vote, block_time: v.block_time });
            }
          }

          const deduped = [...latestByProposal.values()];
          const yes = deduped.filter(v => v.vote === 'Yes').length;
          const no = deduped.filter(v => v.vote === 'No').length;
          const abstain = deduped.filter(v => v.vote === 'Abstain').length;
          const total = deduped.length;

          const { data: existing } = await supabase.from('dreps').select('info').eq('id', drepId).single();
          if (!existing?.info) continue;
          const info = existing.info as Record<string, unknown>;
          if (info.totalVotes === total && info.yesVotes === yes && info.noVotes === no) continue;

          await supabase.from('dreps').update({
            info: { ...info, totalVotes: total, yesVotes: yes, noVotes: no, abstainVotes: abstain },
          }).eq('id', drepId);
          reconciled++;
        }
      }
      if (reconciled > 0) console.log(`[Sync] Vote count reconciliation: ${reconciled} DReps updated`);
    })(),

    // DRep metadata hash verification (blake2b-256)
    (async () => {
      const { data: unchecked } = await supabase.from('dreps')
        .select('id')
        .is('metadata_hash_verified', null)
        .limit(30);
      if (!unchecked?.length) return;

      const drepIds = unchecked.map(r => r.id);
      const infoList = await fetchDRepInfo(drepIds);
      const anchorMap = new Map<string, { url: string; hash: string }>();
      for (const info of infoList) {
        if (info.anchor_url && info.anchor_hash) {
          anchorMap.set(info.drep_id, { url: info.anchor_url, hash: info.anchor_hash });
        }
      }

      let verified = 0, failed = 0, noData = 0;
      for (const id of drepIds) {
        const anchor = anchorMap.get(id);
        if (!anchor) { noData++; continue; }
        try {
          let fetchUrl = anchor.url;
          if (fetchUrl.startsWith('ipfs://')) fetchUrl = `https://ipfs.io/ipfs/${fetchUrl.slice(7)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(fetchUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) continue;
          const rawBytes = new Uint8Array(await res.arrayBuffer());
          const computedHash = blake2bHex(rawBytes, undefined, 32);
          const matches = computedHash === anchor.hash;
          await supabase.from('dreps')
            .update({ metadata_hash_verified: matches })
            .eq('id', id);
          if (matches) verified++; else failed++;
        } catch { /* skip */ }
      }
      if (verified + failed > 0) console.log(`[Sync] DRep metadata hash: ${verified} verified, ${failed} mismatch, ${noData} no anchor`);
    })(),
  ]);

  for (const r of phase5Results) {
    if (r.status === 'rejected') console.error('[Sync] Phase 5 error:', r.reason);
  }

  // ═══ PHASE 5b: Integrity snapshot ═════════════════════════════════════════
  try {
    const [snapVpc, snapAi, snapHv, snapCs, snapStats] = await Promise.all([
      supabase.from('v_vote_power_coverage').select('*').single(),
      supabase.from('v_ai_summary_coverage').select('*').single(),
      supabase.from('v_hash_verification').select('*').single(),
      supabase.from('v_canonical_summary_coverage').select('*').single(),
      supabase.from('v_system_stats').select('*').single(),
    ]);
    const vpc = snapVpc.data;
    const sai = snapAi.data;
    const shv = snapHv.data;
    const scs = snapCs.data;
    const sst = snapStats.data;
    if (vpc && sai && scs && sst) {
      const aiProposalPct = sai.proposals_with_abstract > 0
        ? Math.round(sai.proposals_with_summary / sai.proposals_with_abstract * 100) : 100;
      const aiRationalePct = sai.rationales_with_text > 0
        ? Math.round(sai.rationales_with_summary / sai.rationales_with_text * 100) : 100;
      const canonicalPct = scs.total_proposals > 0
        ? Math.round(scs.with_canonical_summary / scs.total_proposals * 100) : 0;
      await supabase.from('integrity_snapshots').upsert({
        snapshot_date: new Date().toISOString().split('T')[0],
        vote_power_coverage_pct: parseFloat(vpc.coverage_pct),
        canonical_summary_pct: canonicalPct,
        ai_proposal_pct: aiProposalPct,
        ai_rationale_pct: aiRationalePct,
        hash_mismatch_rate_pct: shv ? parseFloat(shv.mismatch_rate_pct) : 0,
        total_dreps: sst.total_dreps,
        total_votes: sst.total_votes,
        total_proposals: sst.total_proposals,
        total_rationales: sst.total_rationales,
        metrics_json: { vpc, ai: sai, hv: shv, cs: scs, stats: sst },
      }, { onConflict: 'snapshot_date' });
      console.log('[Sync] Integrity snapshot saved');
    }
  } catch (err) {
    console.warn('[Sync] Integrity snapshot failed:', err instanceof Error ? err.message : err);
  }

  // ═══ PHASE 6: Push notifications ══════════════════════════════════════════

  let pushSent = 0;
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
    console.warn('[Sync] Push notification phase skipped:', err);
  }

  // ═══ Summary ══════════════════════════════════════════════════════════════

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const totalRows = drepResult.success + drepResult.errors + voteResult.success + voteResult.errors + proposalResult.success + proposalResult.errors;
  const totalErrors = drepResult.errors + voteResult.errors + proposalResult.errors;
  const errorRate = totalRows > 0 ? totalErrors / totalRows : 0;
  const success = errorRate < 0.05 && syncErrors.length === 0;

  if (totalErrors > 0) {
    syncErrors.push(`Upsert errors: ${drepResult.errors} dreps, ${voteResult.errors} votes, ${proposalResult.errors} proposals (${(errorRate * 100).toFixed(1)}% rate)`);
  }

  console.log(`[Sync] Complete in ${duration}s — DReps: ${drepResult.success}, Votes: ${voteResult.success}, Proposals: ${proposalResult.success}${pushSent > 0 ? `, Push: ${pushSent}` : ''}${syncErrors.length > 0 ? ` (${syncErrors.length} issues)` : ''}`);

  const metrics = {
    dreps_synced: drepResult.success, drep_errors: drepResult.errors,
    votes_synced: voteResult.success, vote_errors: voteResult.errors,
    proposals_synced: proposalResult.success, proposal_errors: proposalResult.errors,
    push_sent: pushSent,
  };

  await finalizeSyncLog(
    success,
    syncErrors.length > 0 ? syncErrors.join('; ') : null,
    metrics,
  );

  try {
    const { captureServerEvent } = await import('@/lib/posthog-server');
    captureServerEvent(success ? 'sync_completed' : 'sync_failed', {
      sync_type: 'full', duration_ms: Date.now() - startTime, ...metrics,
    });
  } catch { /* posthog optional */ }

  return NextResponse.json({
    success,
    dreps: { synced: drepResult.success, errors: drepResult.errors },
    votes: { synced: voteResult.success, errors: voteResult.errors },
    proposals: { synced: proposalResult.success, errors: proposalResult.errors },
    durationSeconds: duration,
    timestamp: new Date().toISOString(),
  }, { status: success ? 200 : 207 });
}
