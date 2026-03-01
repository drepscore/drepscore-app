import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const notifications = await sql`
  SELECT
    id,
    wallet_address,
    event_type,
    title,
    read,
    sent_at,
    created_at
  FROM notification_log
  ORDER BY sent_at DESC
  LIMIT 500
`;

await sql.end();
process.stdout.write(JSON.stringify(notifications));
