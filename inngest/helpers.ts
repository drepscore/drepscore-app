/**
 * Shared helper for Inngest functions that delegate to existing API routes.
 * Each sync route already handles logging, error tracking, and PostHog events.
 * Inngest adds scheduling, retry, and observability on top.
 */

import { alertDiscord, emitPostHog } from '@/lib/sync-utils';
import type { SyncType } from '@/lib/sync-utils';

export async function callSyncRoute(
  path: string,
  timeoutMs: number,
): Promise<{ status: number; body: unknown }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('CRON_SECRET not configured');
  }

  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await res.json().catch(() => ({ raw: 'Non-JSON response' }));

  if (!res.ok && res.status >= 500) {
    throw new Error(`${path} returned ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }

  if (res.status === 207) {
    const syncType = path.replace('/api/sync/', '') as SyncType;
    const b = body as Record<string, unknown>;
    const errorCount = Array.isArray(b.errors) ? b.errors.length : 0;
    const totalRecords = typeof b.total === 'number' ? b.total : 0;

    emitPostHog(true, syncType, 0, {
      event_override: 'sync_degraded',
      error_count: errorCount,
      total_records: totalRecords,
    });
    alertDiscord(
      `Degraded Sync: ${syncType}`,
      `Route ${path} returned 207 (partial success). ${errorCount} errors.`,
    );
  }

  return { status: res.status, body };
}
