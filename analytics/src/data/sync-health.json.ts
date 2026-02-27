import { resolve } from "node:path";
import postgres from "postgres";

process.loadEnvFile(resolve(process.cwd(), ".env"));
const sql = postgres(process.env.DATABASE_URL!);

const syncs = await sql`
  SELECT
    id,
    sync_type,
    started_at,
    finished_at,
    duration_ms,
    success,
    COALESCE(
      error_message,
      metrics->>'error',
      metrics->>'errorMessage',
      metrics->>'reason',
      CASE WHEN success = false AND error_message IS NULL
           THEN 'Failed (no error message recorded)'
           ELSE NULL
      END
    ) AS error_message,
    metrics,
    created_at
  FROM sync_log
  ORDER BY created_at DESC
  LIMIT 50
`;

await sql.end();
process.stdout.write(JSON.stringify(syncs));
