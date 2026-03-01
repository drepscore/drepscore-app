import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const users = await sql`
  SELECT
    wallet_address,
    claimed_drep_id,
    last_login,
    created_at,
    CASE WHEN claimed_drep_id IS NOT NULL THEN true ELSE false END AS has_claimed
  FROM users
  ORDER BY last_login DESC NULLS LAST
  LIMIT 500
`;

const dailySignups = await sql`
  SELECT
    date_trunc('day', created_at) AS day,
    count(*) AS signups,
    count(claimed_drep_id) AS claims
  FROM users
  GROUP BY 1
  ORDER BY 1 DESC
  LIMIT 90
`;

await sql.end();
process.stdout.write(JSON.stringify({ users, dailySignups }));
