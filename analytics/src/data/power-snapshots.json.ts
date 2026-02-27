import { resolve } from "node:path";
import postgres from "postgres";

process.loadEnvFile(resolve(process.cwd(), ".env"));
const sql = postgres(process.env.DATABASE_URL!);

const power = await sql`
  SELECT
    drep_id,
    epoch_no,
    amount_lovelace,
    created_at
  FROM drep_power_snapshots
  ORDER BY epoch_no ASC
`;

await sql.end();
process.stdout.write(JSON.stringify(power));
