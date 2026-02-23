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
import { classifyProposals } from '@/lib/alignment';
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
  consistency_score: number;
  deliberation_modifier: number;
  effective_participation: number;
  size_tier: string;
}

interface SupabaseProposalRow {
  tx_hash: string;
  proposal_index: number;
  proposal_type: string;
  title: string;
  abstract: string;
  withdrawal_amount: number | null;
  treasury_tier: string | null;
  param_changes: Record<string, unknown> | null;
  relevant_prefs: string[];
  proposed_epoch: number;
  block_time: number;
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
const RATIONALE_MAX_PER_SYNC = 30;

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
      
      // CIP-100 format: rationale is nested under body.comment or body.rationale
      if (json.body && typeof json.body === 'object') {
        const bodyText = json.body.comment || json.body.rationale || json.body.motivation;
        if (typeof bodyText === 'string' && bodyText.trim()) return bodyText.trim();
      }
      
      // Flat format fallback
      const rationaleText = json.rationale || json.motivation || json.justification || json.reason;
      if (typeof rationaleText === 'string' && rationaleText.trim()) return rationaleText.trim();
      if (typeof json === 'string') return json.trim();
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

  // Check which ones are already cached
  const txHashes = votesNeedingFetch.map(v => v.vote.vote_tx_hash);
  const { data: existingRows } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash')
    .in('vote_tx_hash', txHashes.slice(0, 1000)); // Supabase IN limit

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

  // Upsert rationales (including null text to mark them as attempted)
  if (rationaleRows.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < rationaleRows.length; i += BATCH_SIZE) {
      const batch = rationaleRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('vote_rationales')
        .upsert(batch, { onConflict: 'vote_tx_hash' });
      if (error) {
        console.error(`[Sync] Rationale upsert error:`, error.message);
      }
    }
  }

  return { fetched: rationaleRows.length, cached: alreadyCached.size };
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

  // ── Fetch enriched DReps from Koios (with raw votes) ─────────────────────
  console.log('[Sync] Starting DRep sync...');

  let allDReps;
  let rawVotesMap: Record<string, DRepVote[]> | undefined;
  try {
    const result = await getEnrichedDReps(false, { includeRawVotes: true });

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
    consistency_score: drep.consistencyScore,
    deliberation_modifier: drep.deliberationModifier,
    effective_participation: drep.effectiveParticipation,
    size_tier: drep.sizeTier,
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

    // ── Upsert inline rationales from meta_json ───────────────────────────
    // Check both CIP-100 nested format (body.comment/body.rationale) and flat format
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

    if (inlineRationales.length > 0) {
      console.log(`[Sync] Upserting ${inlineRationales.length} inline rationales...`);
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

    // ── Fetch rationales from meta_url for uncached votes ─────────────────
    try {
      const rationaleResult = await fetchAndCacheRationales(allVotesForRationale, supabase);
      console.log(`[Sync] Rationales: ${rationaleResult.fetched} fetched, ${rationaleResult.cached} already cached`);
    } catch (err) {
      console.error('[Sync] Rationale fetch phase failed:', err);
    }
  } else {
    console.warn('[Sync] No raw votes map available, skipping vote upsert');
  }

  // ── Fetch and cache proposals ──────────────────────────────────────────────
  console.log('[Sync] Fetching proposals from Koios...');
  let proposalSuccessCount = 0;
  let proposalErrorCount = 0;

  try {
    const rawProposals = await fetchProposals();
    
    if (rawProposals.length > 0) {
      const classifiedProposals = classifyProposals(rawProposals);
      console.log(`[Sync] Classified ${classifiedProposals.length} proposals`);

      const rawProposalRows: SupabaseProposalRow[] = classifiedProposals.map((p) => ({
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
      console.log('[Sync] No proposals fetched from Koios');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Sync] Error syncing proposals:', message);
  }

  // ── Generate AI summaries for proposals without one ──────────────────────
  let aiSummaryCount = 0;
  const AI_SUMMARY_MAX_PER_SYNC = 10;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { data: unsummarized } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount')
        .is('ai_summary', null)
        .not('abstract', 'is', null)
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
              model: 'claude-3-5-haiku-latest',
              max_tokens: 200,
              messages: [{
                role: 'user',
                content: `Summarize this Cardano governance proposal in 2-3 sentences for a casual ADA holder. Focus on what it does, who it affects, and why it matters. Be concise and neutral.\n\nTitle: ${row.title || 'Untitled'}\nType: ${row.proposal_type}${amountContext}\nDescription: ${(row.abstract || '').slice(0, 2000)}`,
              }],
            });

            const summary = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;

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

  console.log(`[Sync] Complete — ${successCount} DReps, ${voteSuccessCount} votes, ${proposalSuccessCount} proposals, ${aiSummaryCount} AI summaries synced in ${durationSeconds}s`);
  return NextResponse.json({
    success: true,
    dreps: { synced: successCount, total: rows.length },
    votes: { synced: voteSuccessCount },
    proposals: { synced: proposalSuccessCount },
    aiSummaries: aiSummaryCount,
    durationSeconds,
    timestamp: new Date().toISOString(),
  });
}
