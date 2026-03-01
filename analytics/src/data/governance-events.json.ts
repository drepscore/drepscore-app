import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const pollActivity = await sql`
  SELECT
    date_trunc('day', created_at) AS day,
    count(*) AS votes,
    count(DISTINCT wallet_address) AS unique_voters
  FROM poll_responses
  GROUP BY 1
  ORDER BY 1 DESC
  LIMIT 90
`;

const watchlistActivity = await sql`
  SELECT
    date_trunc('day', created_at) AS day,
    count(*) AS additions
  FROM user_watchlist
  GROUP BY 1
  ORDER BY 1 DESC
  LIMIT 90
`;

await sql.end();
process.stdout.write(JSON.stringify({ pollActivity, watchlistActivity }));
