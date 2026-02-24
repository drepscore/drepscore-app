/**
 * DRep Sync API Route
 * Triggered by Vercel Cron (or manually) to pull enriched DRep data from
 * Koios and upsert into Supabase for fast reads.
 *
 * Auth: Callers must supply ?secret=<CRON_SECRET> to prevent unauthorized triggers.
 *
 * Usage:
 *   GET /api/sync?secret=<CRON_SECRET>
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ CRON SETUP (Free Tier Workaround)                                           │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Since Vercel free tier doesn't support native cron jobs, use an external    │
 * │ service to trigger this endpoint on a schedule:                             │
 * │                                                                             │
 * │ Option 1: cron-job.org (free)                                               │
 * │   1. Create account at https://cron-job.org                                 │
 * │   2. Create new cron job with:                                              │
 * │      URL: https://your-app.vercel.app/api/sync?secret=YOUR_CRON_SECRET      │
 * │      Schedule: Every 15 minutes                                             │
 * │                                                                             │
 * │ Option 2: UptimeRobot (free monitoring with HTTP checks)                    │
 * │   1. Create account at https://uptimerobot.com                              │
 * │   2. Add HTTP(s) monitor with:                                              │
 * │      URL: https://your-app.vercel.app/api/sync?secret=YOUR_CRON_SECRET      │
 * │      Interval: 15 minutes                                                   │
 * │                                                                             │
 * │ Note: Set CRON_SECRET in Vercel Environment Variables                       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnrichedDReps, blockTimeToEpoch } from '@/lib/koios';
import { fetchProposals } from '@/utils/koios';
import { DRepVote } from '@/types/koios';
import { classifyProposals, computeAllCategoryScores } from '@/lib/alignment';
import type { ClassifiedProposal } from '@/types/koios';
import type { ProposalContext } from '@/utils/scoring';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Vercel function timeout: allow up to 5 minutes for full sync
export const maxDuration = 300;

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
}

interface SupabaseProposalRow {
  tx_hash: string;
  proposal_index: number;
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

// ── Rationale Fetching Helpers ────────────────────────────────────────────────

const RATIONALE_FETCH_TIMEOUT_MS = 5000;
const RATIONALE_MAX_CONTENT_SIZE = 50000; // 50KB
const RATIONALE_CONCURRENCY = 3;
// Cap IPFS fetches per sync run so the function stays within Vercel's timeout.
// Each subsequent sync incrementally fetches more. ~30 fetches * 5s / 3 concurrency = ~50s.
const RATIONALE_MAX_PER_SYNC = 100;

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

      // CIP-100 JSON-LD: body.comment, body.rationale, body.motivation (may be string or {\"@value\": ...})
      if (json.body && typeof json.body === 'object') {
        for (const key of ['comment', 'rationale', 'motivation']) {
          const extracted = extractJsonLdString(json.body[key]);
          if (extracted) return extracted;
        }
      }

      // Flat format fallback
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

/**
 * Fetch rationales for votes that have meta_url but no inline rationale,
 * with concurrency limiting. Skips votes already in the rationale cache.
 */
async function fetchAndCacheRationales(
  allVotes: { drepId: string; vote: DRepVote }[],
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ fetched: number; cached: number }> {
  // Filter to votes that have a meta_url and no inline rationale
  const votesNeedingFetch = allVotes.filter(
    v => v.vote.meta_url
      && !v.vote.meta_json?.rationale
      && !v.vote.meta_json?.body?.comment
      && !v.vote.meta_json?.body?.rationale
  );

  if (votesNeedingFetch.length === 0) return { fetched: 0, cached: 0 };

  // Check which ones already have successful rationale (non-null text only — retry failures)
  const txHashes = votesNeedingFetch.map(v => v.vote.vote_tx_hash);
  const { data: existingRows } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash')
    .in('vote_tx_hash', txHashes.slice(0, 1000))
    .not('rationale_text', 'is', null);

  const alreadyCached = new Set((existingRows || []).map(r => r.vote_tx_hash));
  const allUncached = votesNeedingFetch.filter(v => !alreadyCached.has(v.vote.vote_tx_hash));
  // Process only the most recent uncached votes to stay within function timeout
  const uncached = allUncached.slice(0, RATIONALE_MAX_PER_SYNC);

  if (uncached.length === 0) return { fetched: 0, cached: alreadyCached.size };
  if (allUncached.length > RATIONALE_MAX_PER_SYNC) {
    console.log(`[Sync] Rationale fetch capped at ${RATIONALE_MAX_PER_SYNC}/${allUncached.length} uncached votes (remaining will be fetched in future syncs)`);
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
  const failCount = rationaleRows.length - successRows.length;
  console.log(`[Sync] Rationale URL fetch results: ${successRows.length} succeeded, ${failCount} failed (will retry next sync)`);

  if (successRows.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < successRows.length; i += BATCH_SIZE) {
      const batch = successRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('vote_rationales')
        .upsert(batch, { onConflict: 'vote_tx_hash' });
      if (error) {
        console.error(`[Sync] Rationale upsert error:`, error.message);
      }
    }
  }

  return { fetched: successRows.length, cached: alreadyCached.size };
}

// ── Main Sync Handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // ── Auth check ────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Sync] CRON_SECRET env var is not set');
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration: CRON_SECRET not set' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const providedSecret = searchParams.get('secret');

  if (providedSecret !== cronSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // ── Fetch proposals FIRST for proposal-type-weighted rationale scoring ────
  console.log('[Sync] Starting DRep sync...');
  console.log('[Sync] Fetching proposals from Koios (needed for weighted rationale scoring)...');

  let classifiedProposalsList: ClassifiedProposal[] = [];
  const proposalContextMap = new Map<string, ProposalContext>();

  try {
    const rawProposals = await fetchProposals();
    if (rawProposals.length > 0) {
      classifiedProposalsList = classifyProposals(rawProposals);
      for (const p of classifiedProposalsList) {
        proposalContextMap.set(`${p.txHash}-${p.index}`, {
          proposalType: p.type,
          treasuryTier: p.treasuryTier,
        });
      }
      console.log(`[Sync] Built proposal context map: ${proposalContextMap.size} proposals`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[Sync] Proposal pre-fetch failed, rationale scoring will use equal weights:', message);
  }

  // ── Fetch enriched DReps from Koios (with raw votes + proposal context) ──
  let allDReps;
  let rawVotesMap: Record<string, DRepVote[]> | undefined;
  try {
    const result = await getEnrichedDReps(false, {
      includeRawVotes: true,
      proposalContextMap: proposalContextMap.size > 0 ? proposalContextMap : undefined,
    });

    if (result.error) {
      console.error('[Sync] Failed to fetch DReps from Koios');
      return NextResponse.json(
        { success: false, error: 'Koios API fetch failed' },
        { status: 502 }
      );
    }

    if (!result.allDReps || result.allDReps.length === 0) {
      console.warn('[Sync] No DReps returned from Koios');
      return NextResponse.json(
        { success: false, error: 'No DReps returned from Koios' },
        { status: 502 }
      );
    }

    allDReps = result.allDReps;
    rawVotesMap = result.rawVotesMap as Record<string, DRepVote[]> | undefined;
    console.log(`[Sync] Fetched ${allDReps.length} DReps from Koios`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Sync] Exception during Koios fetch:', message);
    return NextResponse.json(
      { success: false, error: `Koios fetch exception: ${message}` },
      { status: 500 }
    );
  }

  // ── Transform to Supabase schema ──────────────────────────────────────────
  const rows: SupabaseDRepRow[] = allDReps.map((drep) => ({
    id: drep.drepId,
    metadata: (drep.metadata as Record<string, unknown>) || {},
    info: {
      drepHash: drep.drepHash,
      handle: drep.handle,
      name: drep.name,
      ticker: drep.ticker,
      description: drep.description,
      votingPower: drep.votingPower,
      votingPowerLovelace: drep.votingPowerLovelace,
      delegatorCount: drep.delegatorCount,
      totalVotes: drep.totalVotes,
      yesVotes: drep.yesVotes,
      noVotes: drep.noVotes,
      abstainVotes: drep.abstainVotes,
      isActive: drep.isActive,
      anchorUrl: drep.anchorUrl,
      epochVoteCounts: drep.epochVoteCounts,
    },
    votes: [],
    score: drep.drepScore,
    participation_rate: drep.participationRate,
    rationale_rate: drep.rationaleRate,
    reliability_score: drep.reliabilityScore,
    reliability_streak: drep.reliabilityStreak,
    reliability_recency: drep.reliabilityRecency,
    reliability_longest_gap: drep.reliabilityLongestGap,
    reliability_tenure: drep.reliabilityTenure,
    deliberation_modifier: drep.deliberationModifier,
    effective_participation: drep.effectiveParticipation,
    size_tier: drep.sizeTier,
    profile_completeness: drep.profileCompleteness,
  }));

  // ── Upsert DReps to Supabase ─────────────────────────────────────────────
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Sync] Failed to create Supabase admin client:', message);
    return NextResponse.json(
      { success: false, error: `Supabase init failed: ${message}` },
      { status: 500 }
    );
  }

  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const { error: upsertError } = await supabase
      .from('dreps')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

    if (upsertError) {
      console.error(`[Sync] DRep batch ${batchNumber}/${totalBatches} error:`, upsertError.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`[Sync] DRep batch ${batchNumber}/${totalBatches} complete (${batch.length} rows)`);
    }
  }

  // ── Upsert individual votes to drep_votes ─────────────────────────────────
  let voteSuccessCount = 0;
  let voteErrorCount = 0;

  if (rawVotesMap) {
    const voteRows: SupabaseVoteRow[] = [];
    const allVotesForRationale: { drepId: string; vote: DRepVote }[] = [];

    for (const [drepId, votes] of Object.entries(rawVotesMap)) {
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

    // Deduplicate votes by vote_tx_hash -- same safeguard as proposals
    const dedupedVoteRows = [...new Map(voteRows.map(r => [r.vote_tx_hash, r])).values()];
    if (dedupedVoteRows.length !== voteRows.length) {
      console.log(`[Sync] Deduplicated votes: ${voteRows.length} → ${dedupedVoteRows.length}`);
    }

    console.log(`[Sync] Upserting ${dedupedVoteRows.length} individual votes...`);

    const voteBatches = Math.ceil(dedupedVoteRows.length / BATCH_SIZE);
    for (let i = 0; i < dedupedVoteRows.length; i += BATCH_SIZE) {
      const batch = dedupedVoteRows.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      const { error: upsertError } = await supabase
        .from('drep_votes')
        .upsert(batch, { onConflict: 'vote_tx_hash', ignoreDuplicates: false });

      if (upsertError) {
        console.error(`[Sync] Vote batch ${batchNumber}/${voteBatches} error:`, upsertError.message);
        voteErrorCount += batch.length;
      } else {
        voteSuccessCount += batch.length;
        if (batchNumber % 10 === 0 || batchNumber === voteBatches) {
          console.log(`[Sync] Vote batch ${batchNumber}/${voteBatches} complete`);
        }
      }
    }

    // ── Rationale diagnostics ─────────────────────────────────────────────
    const votesWithMetaUrl = allVotesForRationale.filter(v => v.vote.meta_url);
    const votesWithMetaJson = allVotesForRationale.filter(v => v.vote.meta_json != null);
    console.log(`[Sync] Rationale diagnostics: ${allVotesForRationale.length} total votes, ${votesWithMetaUrl.length} have meta_url, ${votesWithMetaJson.length} have meta_json`);

    // Log sample meta_urls for manual verification
    if (votesWithMetaUrl.length > 0) {
      const samples = votesWithMetaUrl.slice(0, 3).map(v => `  ${v.vote.vote_tx_hash.slice(0, 12)}... → ${v.vote.meta_url}`);
      console.log(`[Sync] Sample meta_urls:\n${samples.join('\n')}`);
    }

    // ── Upsert inline rationales from meta_json ───────────────────────────
    const inlineRationales: SupabaseRationaleRow[] = [];
    for (const { drepId, vote } of allVotesForRationale) {
      const rationaleText =
        vote.meta_json?.body?.comment ||
        vote.meta_json?.body?.rationale ||
        vote.meta_json?.rationale;

      if (rationaleText && typeof rationaleText === 'string') {
        inlineRationales.push({
          vote_tx_hash: vote.vote_tx_hash,
          drep_id: drepId,
          proposal_tx_hash: vote.proposal_tx_hash,
          proposal_index: vote.proposal_index,
          meta_url: vote.meta_url,
          rationale_text: rationaleText,
        });
      }
    }

    console.log(`[Sync] Inline rationales from meta_json: ${inlineRationales.length} (expected ~0 if Koios doesn't return meta_json)`);

    if (inlineRationales.length > 0) {
      for (let i = 0; i < inlineRationales.length; i += BATCH_SIZE) {
        const batch = inlineRationales.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('vote_rationales')
          .upsert(batch, { onConflict: 'vote_tx_hash' });
        if (error) {
          console.error(`[Sync] Inline rationale upsert error:`, error.message);
        }
      }
    }

    // ── Clean up previously cached null rationales so they get retried ────
    const { count: purgedNulls } = await supabase
      .from('vote_rationales')
      .delete({ count: 'exact' })
      .is('rationale_text', null);
    if (purgedNulls && purgedNulls > 0) {
      console.log(`[Sync] Purged ${purgedNulls} null-rationale rows (will retry fetches)`);
    }

    // ── Fetch rationales from meta_url for uncached votes ─────────────────
    try {
      const rationaleResult = await fetchAndCacheRationales(allVotesForRationale, supabase);
      console.log(`[Sync] Rationales: ${rationaleResult.fetched} new, ${rationaleResult.cached} already cached`);
    } catch (err) {
      console.error('[Sync] Rationale fetch phase failed:', err);
    }
  } else {
    console.warn('[Sync] No raw votes map available, skipping vote upsert');
  }

  // ── Upsert proposals to Supabase (already fetched and classified above) ───
  let proposalSuccessCount = 0;
  let proposalErrorCount = 0;

  try {
    if (classifiedProposalsList.length > 0) {
      const rawProposalRows: SupabaseProposalRow[] = classifiedProposalsList.map((p) => ({
        tx_hash: p.txHash,
        proposal_index: p.index,
        proposal_type: p.type,
        title: p.title,
        abstract: p.abstract,
        withdrawal_amount: p.withdrawalAmountAda,
        treasury_tier: p.treasuryTier,
        param_changes: p.paramChanges,
        relevant_prefs: p.relevantPrefs,
        proposed_epoch: p.proposedEpoch,
        block_time: p.blockTime,
        expired_epoch: p.expiredEpoch,
        ratified_epoch: p.ratifiedEpoch,
        enacted_epoch: p.enactedEpoch,
        dropped_epoch: p.droppedEpoch,
      }));

      // Deduplicate by (tx_hash, proposal_index) -- Koios may return the same proposal
      // multiple times, and PostgreSQL's ON CONFLICT DO UPDATE rejects duplicate keys
      // within the same batch command.
      const proposalRows = [...new Map(
        rawProposalRows.map(row => [`${row.tx_hash}-${row.proposal_index}`, row])
      ).values()];

      if (rawProposalRows.length !== proposalRows.length) {
        console.log(`[Sync] Deduplicated proposals: ${rawProposalRows.length} → ${proposalRows.length}`);
      }

      const proposalBatches = Math.ceil(proposalRows.length / BATCH_SIZE);
      for (let i = 0; i < proposalRows.length; i += BATCH_SIZE) {
        const batch = proposalRows.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        const { error: upsertError } = await supabase
          .from('proposals')
          .upsert(batch, { onConflict: 'tx_hash,proposal_index', ignoreDuplicates: false });

        if (upsertError) {
          console.error(`[Sync] Proposal batch ${batchNumber}/${proposalBatches} error:`, upsertError.message);
          proposalErrorCount += batch.length;
        } else {
          proposalSuccessCount += batch.length;
          console.log(`[Sync] Proposal batch ${batchNumber}/${proposalBatches} complete (${batch.length} rows)`);
        }
      }
    } else {
      console.log('[Sync] No proposals to upsert');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Sync] Error upserting proposals:', message);
  }

  // ── Generate AI summaries for proposals without one ──────────────────────
  let aiSummaryCount = 0;
  const AI_SUMMARY_MAX_PER_SYNC = 10;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // Clear summaries containing raw IPFS/HTTP URLs so they get re-generated
      const { data: badSummaries } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index')
        .not('ai_summary', 'is', null)
        .or('ai_summary.ilike.%ipfs.io%,ai_summary.ilike.%ipfs://%,ai_summary.ilike.%bafkrei%');

      if (badSummaries && badSummaries.length > 0) {
        for (const row of badSummaries) {
          await supabase.from('proposals').update({ ai_summary: null })
            .eq('tx_hash', row.tx_hash).eq('proposal_index', row.proposal_index);
        }
        console.log(`[Sync] Cleared ${badSummaries.length} AI summaries with raw URLs for re-generation`);
      }

      const { data: unsummarized } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount')
        .is('ai_summary', null)
        .not('abstract', 'is', null)
        .neq('abstract', '')
        .limit(AI_SUMMARY_MAX_PER_SYNC);

      if (unsummarized && unsummarized.length > 0) {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        console.log(`[Sync] Generating AI summaries for ${unsummarized.length} proposals...`);

        for (const row of unsummarized) {
          try {
            const amountContext = row.withdrawal_amount
              ? `\nWithdrawal Amount: ${Number(row.withdrawal_amount).toLocaleString()} ADA`
              : '';

            const msg = await anthropic.messages.create({
              model: 'claude-sonnet-4-5',
              max_tokens: 200,
              messages: [{
                role: 'user',
                content: `Summarize this Cardano governance proposal in 2-3 sentences for a casual ADA holder. Focus on what it does, who it affects, and why it matters. Be concise and neutral. Do not include any URLs, links, IPFS hashes, or transaction hashes in the summary.\n\nTitle: ${row.title || 'Untitled'}\nType: ${row.proposal_type}${amountContext}\nDescription: ${(row.abstract || '').slice(0, 2000)}`,
              }],
            });

            const rawSummary = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
            const summary = rawSummary
              ? rawSummary.replace(/https?:\/\/\S+/g, '').replace(/ipfs:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim()
              : null;

            if (summary) {
              await supabase
                .from('proposals')
                .update({ ai_summary: summary })
                .eq('tx_hash', row.tx_hash)
                .eq('proposal_index', row.proposal_index);
              aiSummaryCount++;
            }
          } catch (aiErr) {
            console.error(`[Sync] AI summary error for ${row.tx_hash}:`, aiErr);
          }
        }
        console.log(`[Sync] Generated ${aiSummaryCount} AI summaries`);
      }
    } catch (err) {
      console.error('[Sync] AI summary phase failed:', err);
    }
  }

  // ── Compute per-category alignment scores for all DReps ──────────────────
  let alignmentUpdateCount = 0;

  if (rawVotesMap && classifiedProposalsList.length > 0) {
    console.log(`[Sync] Computing alignment scores for ${allDReps.length} DReps...`);

    const alignmentUpdates: { id: string; [key: string]: unknown }[] = [];

    for (const drep of allDReps) {
      const votes = rawVotesMap[drep.drepId] || [];
      const scores = computeAllCategoryScores(drep, votes, classifiedProposalsList);

      alignmentUpdates.push({
        id: drep.drepId,
        alignment_treasury_conservative: scores.alignmentTreasuryConservative,
        alignment_treasury_growth: scores.alignmentTreasuryGrowth,
        alignment_decentralization: scores.alignmentDecentralization,
        alignment_security: scores.alignmentSecurity,
        alignment_innovation: scores.alignmentInnovation,
        alignment_transparency: scores.alignmentTransparency,
        last_vote_time: scores.lastVoteTime,
      });
    }

    const alignmentBatches = Math.ceil(alignmentUpdates.length / BATCH_SIZE);
    for (let i = 0; i < alignmentUpdates.length; i += BATCH_SIZE) {
      const batch = alignmentUpdates.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      const { error: upsertError } = await supabase
        .from('dreps')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

      if (upsertError) {
        console.error(`[Sync] Alignment batch ${batchNumber}/${alignmentBatches} error:`, upsertError.message);
      } else {
        alignmentUpdateCount += batch.length;
        if (batchNumber % 5 === 0 || batchNumber === alignmentBatches) {
          console.log(`[Sync] Alignment batch ${batchNumber}/${alignmentBatches} complete`);
        }
      }
    }

    console.log(`[Sync] Alignment scores computed for ${alignmentUpdateCount} DReps`);
  } else {
    console.warn('[Sync] Skipping alignment computation (missing votes or proposals)');
  }

  // ── Snapshot score history (one row per DRep per day) ─────────────────────
  let scoreHistoryCount = 0;
  try {
    const today = new Date().toISOString().split('T')[0];
    const historyRows = allDReps.map((drep) => ({
      drep_id: drep.drepId,
      score: drep.drepScore,
      effective_participation: drep.effectiveParticipation,
      rationale_rate: drep.rationaleRate,
      reliability_score: drep.reliabilityScore,
      profile_completeness: drep.profileCompleteness,
      snapshot_date: today,
    }));

    for (let i = 0; i < historyRows.length; i += BATCH_SIZE) {
      const batch = historyRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('drep_score_history')
        .upsert(batch, { onConflict: 'drep_id,snapshot_date', ignoreDuplicates: false });
      if (error) {
        // Table may not exist yet -- log but don't fail the sync
        if (i === 0) console.warn(`[Sync] Score history upsert skipped (table may not exist): ${error.message}`);
        break;
      }
      scoreHistoryCount += batch.length;
    }

    if (scoreHistoryCount > 0) {
      console.log(`[Sync] Score history: ${scoreHistoryCount} snapshots saved for ${today}`);
    }
  } catch (err) {
    console.warn('[Sync] Score history phase skipped:', err);
  }

  // ── Social link reachability checks (max 50 per sync run) ────────────────
  let linkChecksCount = 0;
  try {
    const LINK_CHECK_LIMIT = 50;
    const STALE_DAYS = 14;
    const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Collect all DRep social URIs (deduplicated per DRep)
    const allLinks: { drep_id: string; uri: string }[] = [];
    const seenLinkKeys = new Set<string>();
    for (const drep of allDReps) {
      const refs = drep.metadata?.references;
      if (!Array.isArray(refs)) continue;
      for (const ref of refs) {
        if (ref && typeof ref === 'object' && 'uri' in ref) {
          const uri = (ref as { uri: unknown }).uri;
          if (typeof uri === 'string' && uri.startsWith('http')) {
            const key = `${drep.drepId}|${uri}`;
            if (seenLinkKeys.has(key)) continue;
            seenLinkKeys.add(key);
            allLinks.push({ drep_id: drep.drepId, uri });
          }
        }
      }
    }

    if (allLinks.length > 0) {
      // Find which ones are already fresh
      const uris = allLinks.map(l => l.uri);
      const { data: existing } = await supabase
        .from('social_link_checks')
        .select('drep_id, uri, last_checked_at')
        .in('uri', uris.slice(0, 500));

      const freshSet = new Set<string>();
      if (existing) {
        for (const row of existing) {
          if (row.last_checked_at && row.last_checked_at > staleThreshold) {
            freshSet.add(`${row.drep_id}|${row.uri}`);
          }
        }
      }

      const toCheck = allLinks
        .filter(l => !freshSet.has(`${l.drep_id}|${l.uri}`))
        .slice(0, LINK_CHECK_LIMIT);

      const isTwitterUrl = (url: string) =>
        /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i.test(url);

      for (const link of toCheck) {
        let status = 'broken';
        let httpStatus: number | null = null;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          if (isTwitterUrl(link.uri)) {
            // X/Twitter returns 200 for non-existent accounts; use GET + body inspection
            const res = await fetch(link.uri, {
              method: 'GET',
              redirect: 'follow',
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DRepScore/1.0)',
                'Accept': 'text/html',
              },
            });
            clearTimeout(timeout);
            httpStatus = res.status;
            if (!res.ok) {
              status = 'broken';
            } else {
              const body = await res.text();
              const soft404 =
                body.includes('This account doesn') ||
                body.includes('Account suspended') ||
                body.includes('"error"') ||
                (body.includes('"users":[]') && body.length < 500);
              status = soft404 ? 'broken' : 'valid';
            }
          } else {
            const res = await fetch(link.uri, {
              method: 'HEAD',
              redirect: 'follow',
              signal: controller.signal,
              headers: { 'User-Agent': 'DRepScore-LinkChecker/1.0' },
            });
            clearTimeout(timeout);
            httpStatus = res.status;
            status = res.ok ? 'valid' : 'broken';
          }
        } catch {
          status = 'broken';
        }

        await supabase
          .from('social_link_checks')
          .upsert({
            drep_id: link.drep_id,
            uri: link.uri,
            status,
            http_status: httpStatus,
            last_checked_at: new Date().toISOString(),
          }, { onConflict: 'drep_id,uri' });

        linkChecksCount++;
      }

      if (linkChecksCount > 0) {
        console.log(`[Sync] Social link checks: ${linkChecksCount} links verified`);
      }
    }
  } catch (err) {
    console.warn('[Sync] Social link check phase skipped:', err);
  }

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  const hasErrors = errorCount > 0 || proposalErrorCount > 0 || voteErrorCount > 0;

  if (hasErrors) {
    console.warn(`[Sync] Completed with errors in ${durationSeconds}s — DReps: ${successCount} ok, ${errorCount} failed; Votes: ${voteSuccessCount} ok, ${voteErrorCount} failed; Proposals: ${proposalSuccessCount} ok, ${proposalErrorCount} failed`);
    return NextResponse.json(
      {
        success: false,
        dreps: { synced: successCount, errors: errorCount, total: rows.length },
        votes: { synced: voteSuccessCount, errors: voteErrorCount },
        proposals: { synced: proposalSuccessCount, errors: proposalErrorCount },
        durationSeconds,
        timestamp: new Date().toISOString(),
      },
      { status: 207 }
    );
  }

  console.log(`[Sync] Complete — ${successCount} DReps, ${voteSuccessCount} votes, ${proposalSuccessCount} proposals, ${alignmentUpdateCount} alignments, ${aiSummaryCount} AI summaries synced in ${durationSeconds}s`);
  return NextResponse.json({
    success: true,
    dreps: { synced: successCount, total: rows.length },
    votes: { synced: voteSuccessCount },
    proposals: { synced: proposalSuccessCount },
    alignments: { computed: alignmentUpdateCount },
    aiSummaries: aiSummaryCount,
    durationSeconds,
    timestamp: new Date().toISOString(),
  });
}
