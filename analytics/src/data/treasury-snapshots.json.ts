import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const snapshots = await sql`
  SELECT
    epoch_no,
    balance_lovelace::text AS balance_lovelace,
    withdrawals_lovelace::text AS withdrawals_lovelace,
    reserves_lovelace::text AS reserves_lovelace,
    reserves_income_lovelace::text AS reserves_income_lovelace,
    snapshot_at
  FROM treasury_snapshots
  ORDER BY epoch_no DESC
  LIMIT 500
`;

await sql.end();
process.stdout.write(JSON.stringify(snapshots));
