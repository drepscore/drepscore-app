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
  decentralization_score: number;
  size_tier: string;
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
    },
    votes: [], // Full vote arrays not cached (storage overhead)
    score: drep.drepScore,
    participation_rate: drep.participationRate,
    rationale_rate: drep.rationaleRate,
    decentralization_score: drep.decentralizationScore,
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

  const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  if (errorCount > 0) {
    console.warn(`[Sync] Completed with errors — ${successCount} ok, ${errorCount} failed in ${durationSeconds}s`);
    return NextResponse.json(
      {
        success: false,
        synced: successCount,
        errors: errorCount,
        total: rows.length,
        durationSeconds,
        timestamp: new Date().toISOString(),
      },
      { status: 207 } // 207 Multi-Status: partial success
    );
  }

  console.log(`[Sync] Complete — ${successCount} rows synced in ${durationSeconds}s`);
  return NextResponse.json({
    success: true,
    synced: successCount,
    total: rows.length,
    durationSeconds,
    timestamp: new Date().toISOString(),
  });
}
