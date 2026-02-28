/**
 * Shared helper for Inngest functions that delegate to existing API routes.
 * Each sync route already handles logging, error tracking, and PostHog events.
 * Inngest adds scheduling, retry, and observability on top.
 */

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

  return { status: res.status, body };
}
