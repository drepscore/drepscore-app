import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const briefs = await sql`
  SELECT
    id,
    wallet_address,
    brief_type,
    epoch,
    delivered_channels,
    created_at
  FROM governance_briefs
  ORDER BY created_at DESC
  LIMIT 1000
`;

await sql.end();
process.stdout.write(JSON.stringify(briefs));
