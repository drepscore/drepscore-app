import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

// Hourly stats (last 7 days)
const hourly = await sql`
  SELECT
    date_trunc('hour', created_at) AS hour,
    endpoint,
    tier,
    count(*)::int AS requests,
    count(*) FILTER (WHERE status_code >= 500)::int AS errors_5xx,
    count(*) FILTER (WHERE status_code = 429)::int AS rate_limited,
    CASE WHEN count(*) > 0
      THEN round(count(*) FILTER (WHERE status_code >= 500)::numeric / count(*) * 100, 2)
      ELSE 0
    END AS error_rate_pct,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY response_ms)::int AS p50_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms)::int AS p95_ms,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY response_ms)::int AS p99_ms,
    round(avg(data_age_s)::numeric, 0)::int AS avg_data_age_s
  FROM api_usage_log
  WHERE created_at > now() - interval '7 days'
  GROUP BY 1, 2, 3
  ORDER BY 1 DESC
`;

// Daily stats (last 90 days)
const daily = await sql`
  SELECT
    date_trunc('day', created_at)::date AS day,
    tier,
    count(DISTINCT key_id)::int AS unique_keys,
    count(*)::int AS total_requests,
    count(*) FILTER (WHERE status_code = 429)::int AS rate_limit_hits,
    count(*) FILTER (WHERE status_code >= 500)::int AS errors_5xx,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms)::int AS p95_ms
  FROM api_usage_log
  WHERE created_at > now() - interval '90 days'
  GROUP BY 1, 2
  ORDER BY 1 DESC
`;

// Key stats
const keys = await sql`
  SELECT
    k.id AS key_id,
    k.key_prefix,
    k.name,
    k.tier,
    k.rate_limit,
    k.rate_window,
    k.created_at AS key_created_at,
    k.last_used_at,
    count(l.id) FILTER (WHERE l.created_at > now() - interval '1 hour')::int AS requests_last_hour,
    count(l.id) FILTER (WHERE l.created_at > now() - interval '1 day')::int AS requests_last_day,
    count(l.id) FILTER (WHERE l.created_at > now() - interval '7 days')::int AS requests_last_7d,
    count(l.id) FILTER (WHERE l.status_code >= 500
                         AND l.created_at > now() - interval '1 day')::int AS errors_last_day,
    count(l.id) FILTER (WHERE l.status_code = 429
                         AND l.created_at > now() - interval '1 day')::int AS rate_limits_last_day
  FROM api_keys k
  LEFT JOIN api_usage_log l ON l.key_id = k.id
  WHERE k.revoked_at IS NULL
  GROUP BY k.id
  ORDER BY count(l.id) FILTER (WHERE l.created_at > now() - interval '7 days') DESC
`;

// Recent errors (last 50 5xx)
const recent_errors = await sql`
  SELECT endpoint, error_code, status_code, created_at, key_prefix, tier
  FROM api_usage_log
  WHERE status_code >= 500
    AND created_at > now() - interval '7 days'
  ORDER BY created_at DESC
  LIMIT 50
`;

// Endpoint popularity (last 7 days)
const endpoint_stats = await sql`
  SELECT
    endpoint,
    count(*)::int AS requests,
    count(*) FILTER (WHERE status_code >= 500)::int AS errors,
    CASE WHEN count(*) > 0
      THEN round(count(*) FILTER (WHERE status_code >= 500)::numeric / count(*) * 100, 1)
      ELSE 0
    END AS error_rate_pct,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms)::int AS p95_ms
  FROM api_usage_log
  WHERE created_at > now() - interval '7 days'
  GROUP BY endpoint
  ORDER BY count(*) DESC
`;

// Summary stats (24h)
const summaryRows = await sql`
  SELECT
    count(DISTINCT key_id)::int AS active_keys_24h,
    count(*)::int AS total_requests_24h,
    CASE WHEN count(*) > 0
      THEN round(count(*) FILTER (WHERE status_code >= 500)::numeric / count(*) * 100, 2)
      ELSE 0
    END AS error_rate_24h,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms)::int AS p95_ms_24h,
    count(*) FILTER (WHERE status_code = 429)::int AS rate_limit_hits_24h
  FROM api_usage_log
  WHERE created_at > now() - interval '1 day'
`;

const totalKeys = await sql`SELECT count(*)::int AS total FROM api_keys WHERE revoked_at IS NULL`;

const summary = {
  total_keys: totalKeys[0]?.total || 0,
  active_keys_24h: summaryRows[0]?.active_keys_24h || 0,
  total_requests_24h: summaryRows[0]?.total_requests_24h || 0,
  error_rate_24h: parseFloat(summaryRows[0]?.error_rate_24h) || 0,
  p95_ms_24h: summaryRows[0]?.p95_ms_24h || 0,
  rate_limit_hits_24h: summaryRows[0]?.rate_limit_hits_24h || 0,
};

await sql.end();
process.stdout.write(JSON.stringify({ hourly, daily, keys, recent_errors, endpoint_stats, summary }));
