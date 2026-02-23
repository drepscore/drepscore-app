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
import { getEnrichedDReps } from '@/lib/koios';
import { fetchProposals } from '@/utils/koios';
import { classifyProposals } from '@/lib/alignment';
import { getSupabaseAdmin } from '@/lib/supabase';

// Tell Next.js this route is always dynamic (never statically cached)
export const dynamic = 'force-dynamic';

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

  // ── Fetch enriched DReps from Koios ───────────────────────────────────────
  console.log('[Sync] Starting DRep sync...');

  let allDReps;
  try {
    const result = await getEnrichedDReps(false); // false = ALL DReps, not just well-documented

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
    votes: [], // Full vote arrays not cached (storage overhead)
    score: drep.drepScore,
    participation_rate: drep.participationRate,
    rationale_rate: drep.rationaleRate,
    consistency_score: drep.consistencyScore,
    deliberation_modifier: drep.deliberationModifier,
    effective_participation: drep.effectiveParticipation,
    size_tier: drep.sizeTier,
  }));

  // ── Upsert to Supabase in batches of 100 ─────────────────────────────────
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
      console.error(`[Sync] Batch ${batchNumber}/${totalBatches} error:`, upsertError.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`[Sync] Batch ${batchNumber}/${totalBatches} complete (${batch.length} rows)`);
    }
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

      const proposalRows: SupabaseProposalRow[] = classifiedProposals.map((p) => ({
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

      // Upsert proposals in batches
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

  // ── Rationale caching note ──────────────────────────────────────────────────
  // Rationale text is fetched and cached on-demand via POST /api/rationale
  // when a user views a DRep's profile page. This is more efficient than
  // trying to prefetch all rationales during sync (which would require
  // fetching full vote arrays for all DReps).

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  if (errorCount > 0 || proposalErrorCount > 0) {
    console.warn(`[Sync] Completed with errors — DReps: ${successCount} ok, ${errorCount} failed; Proposals: ${proposalSuccessCount} ok, ${proposalErrorCount} failed in ${durationSeconds}s`);
    return NextResponse.json(
      {
        success: false,
        dreps: { synced: successCount, errors: errorCount, total: rows.length },
        proposals: { synced: proposalSuccessCount, errors: proposalErrorCount },
        durationSeconds,
        timestamp: new Date().toISOString(),
      },
      { status: 207 } // 207 Multi-Status: partial success
    );
  }

  console.log(`[Sync] Complete — ${successCount} DReps, ${proposalSuccessCount} proposals synced in ${durationSeconds}s`);
  return NextResponse.json({
    success: true,
    dreps: { synced: successCount, total: rows.length },
    proposals: { synced: proposalSuccessCount },
    durationSeconds,
    timestamp: new Date().toISOString(),
  });
}
