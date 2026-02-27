import { resolve } from "node:path";
import postgres from "postgres";

process.loadEnvFile(resolve(process.cwd(), ".env"));
const sql = postgres(process.env.DATABASE_URL!);

const integrity = await sql`
  SELECT
    snapshot_date,
    vote_power_coverage_pct,
    canonical_summary_pct,
    ai_proposal_pct,
    ai_rationale_pct,
    hash_mismatch_rate_pct,
    total_dreps,
    total_votes,
    total_proposals,
    total_rationales,
    metrics_json,
    created_at
  FROM integrity_snapshots
  ORDER BY snapshot_date ASC
`;

await sql.end();
process.stdout.write(JSON.stringify(integrity));
