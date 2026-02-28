/**
 * Rate Limiting — Supabase-backed
 * Counts recent requests in api_usage_log to enforce per-key or per-IP limits.
 */

import { getSupabaseAdmin } from '@/lib/supabase';

const ANON_RATE_LIMIT = 10;
const ANON_RATE_WINDOW = 'hour' as const;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
  window: 'hour' | 'day';
  used: number;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(result.resetEpochSeconds),
  };
}

export async function checkRateLimit(opts: {
  keyId?: string | null;
  ipHash?: string | null;
  limit?: number;
  window?: 'hour' | 'day';
}): Promise<RateLimitResult> {
  const limit = opts.limit ?? ANON_RATE_LIMIT;
  const window = opts.window ?? ANON_RATE_WINDOW;
  const intervalSql = window === 'hour' ? '1 hour' : '1 day';

  const supabase = getSupabaseAdmin();

  // Build the filter — match by key_id if available, otherwise by ip_hash
  let query = supabase
    .from('api_usage_log')
    .select('*', { count: 'exact', head: true });

  if (opts.keyId) {
    query = query.eq('key_id', opts.keyId);
  } else if (opts.ipHash) {
    query = query.eq('ip_hash', opts.ipHash).is('key_id', null);
  } else {
    // No identifier — allow through (can't rate limit)
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetEpochSeconds: computeResetEpoch(window),
      window,
      used: 0,
    };
  }

  query = query.gte('created_at', new Date(Date.now() - windowMs(window)).toISOString());

  const { count } = await query;
  const used = count ?? 0;
  const remaining = limit - used;

  return {
    allowed: remaining > 0,
    limit,
    remaining,
    resetEpochSeconds: computeResetEpoch(window),
    window,
    used,
  };
}

function windowMs(window: 'hour' | 'day'): number {
  return window === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

function computeResetEpoch(window: 'hour' | 'day'): number {
  const now = new Date();
  if (window === 'hour') {
    const reset = new Date(now);
    reset.setMinutes(0, 0, 0);
    reset.setHours(reset.getHours() + 1);
    return Math.floor(reset.getTime() / 1000);
  }
  const reset = new Date(now);
  reset.setHours(0, 0, 0, 0);
  reset.setDate(reset.getDate() + 1);
  return Math.floor(reset.getTime() / 1000);
}
