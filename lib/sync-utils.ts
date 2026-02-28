import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export type SyncType = 'dreps' | 'votes' | 'proposals' | 'secondary' | 'slow' | 'full' | 'fast' | 'integrity_check';

const BATCH_SIZE = 100;

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function capMsg(msg: string, max = 2000): string {
  return msg.length <= max ? msg : msg.slice(0, max - 14) + '...[truncated]';
}

export async function batchUpsert<T extends Record<string, unknown>>(
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

export function authorizeCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET not set' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function initSupabase(): { supabase: ReturnType<typeof getSupabaseAdmin> } | { error: NextResponse } {
  try {
    return { supabase: getSupabaseAdmin() };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return { error: NextResponse.json({ success: false, error: `Supabase init failed: ${msg}` }, { status: 500 }) };
  }
}

export class SyncLogger {
  private id: number | null = null;
  private startTime: number;

  constructor(
    private supabase: ReturnType<typeof getSupabaseAdmin>,
    private syncType: SyncType,
  ) {
    this.startTime = Date.now();
  }

  async start() {
    try {
      const { data: logRow } = await this.supabase.from('sync_log')
        .insert({ sync_type: this.syncType, started_at: new Date().toISOString(), success: false })
        .select('id').single();
      this.id = logRow?.id ?? null;
    } catch (_e) { console.warn(`[${this.syncType}] sync_log insert failed:`, errMsg(_e)); }
  }

  async finalize(success: boolean, errorMessage: string | null, metrics: Record<string, unknown>) {
    if (!this.id) return;
    try {
      await this.supabase.from('sync_log').update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - this.startTime,
        success,
        error_message: errorMessage ? capMsg(errorMessage) : null,
        metrics,
      }).eq('id', this.id);
    } catch (_e) { console.warn(`[${this.syncType}] sync_log finalize failed:`, errMsg(_e)); }
  }

  get elapsed() { return Date.now() - this.startTime; }
}

export async function emitPostHog(success: boolean, syncType: SyncType, durationMs: number, metrics: Record<string, unknown>) {
  try {
    const { captureServerEvent } = await import('@/lib/posthog-server');
    captureServerEvent(success ? 'sync_completed' : 'sync_failed', {
      sync_type: syncType, duration_ms: durationMs, ...metrics,
    });
  } catch (_e) { /* posthog optional */ }
}

/**
 * Triggers a Vercel deploy hook for the analytics dashboard.
 * Fire-and-forget — never throws, only logs warnings on failure.
 * Waits 5s before firing to let sync_log writes settle in the DB.
 */
export async function triggerAnalyticsDeploy(syncType: SyncType): Promise<void> {
  const hook = process.env.ANALYTICS_DEPLOY_HOOK;
  if (!hook) return;
  try {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetch(hook, { method: 'POST' });
    if (res.ok) {
      console.log(`[${syncType}] Analytics deploy hook triggered (${res.status})`);
    } else {
      console.warn(`[${syncType}] Analytics deploy hook returned ${res.status}`);
    }
  } catch (e) {
    console.warn(`[${syncType}] Analytics deploy hook failed:`, errMsg(e));
  }
}
