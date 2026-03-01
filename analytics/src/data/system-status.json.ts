import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const syncHealth = await sql`
  SELECT
    sync_type,
    MAX(started_at) AS last_run,
    MAX(finished_at) AS last_finished,
    (SELECT s2.duration_ms FROM sync_log s2 WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) AS last_duration_ms,
    (SELECT s2.success FROM sync_log s2 WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) AS last_success,
    (SELECT s2.error_message FROM sync_log s2 WHERE s2.sync_type = s1.sync_type ORDER BY s2.started_at DESC LIMIT 1) AS last_error,
    COUNT(*) FILTER (WHERE success = true)::int AS success_count,
    COUNT(*) FILTER (WHERE success = false)::int AS failure_count
  FROM sync_log s1
  GROUP BY sync_type
`;

const apiHealth = await sql`
  SELECT
    COUNT(*)::int AS total_requests_1h,
    COUNT(*) FILTER (WHERE status_code >= 500)::int AS errors_5xx_1h,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE status_code >= 500)::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END AS error_rate_1h,
    (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_ms))::int AS p95_ms_1h
  FROM api_usage_log
  WHERE created_at > now() - interval '1 hour'
`;

const dataFreshness = await sql`
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM now() - updated_at) / 3600) AS median_age_hours,
    COUNT(*) FILTER (WHERE updated_at < now() - interval '24 hours')::int AS stale_count,
    COUNT(*)::int AS total_dreps
  FROM dreps
  WHERE (info->>'isActive')::boolean = true
`;

const integrityLatest = await sql`
  SELECT *
  FROM integrity_snapshots
  ORDER BY snapshot_date DESC
  LIMIT 1
`;

const recentFailures = await sql`
  SELECT sync_type, started_at, error_message
  FROM sync_log
  WHERE success = false AND started_at > now() - interval '24 hours'
  ORDER BY started_at DESC
  LIMIT 10
`;

await sql.end();

process.stdout.write(JSON.stringify({
  buildTime: new Date().toISOString(),
  sync: syncHealth,
  api: apiHealth[0],
  freshness: dataFreshness[0],
  integrity: integrityLatest[0] ?? null,
  recentFailures,
}));
