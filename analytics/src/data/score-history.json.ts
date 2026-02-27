import { resolve } from "node:path";
import postgres from "postgres";

process.loadEnvFile(resolve(process.cwd(), ".env"));

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const sql = postgres(url);

const history = await sql`
  SELECT
    drep_id,
    snapshot_date,
    score,
    effective_participation,
    rationale_rate,
    reliability_score,
    profile_completeness
  FROM drep_score_history
  ORDER BY snapshot_date ASC
`;

await sql.end();

process.stdout.write(JSON.stringify(history));
