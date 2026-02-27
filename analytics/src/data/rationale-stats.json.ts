import { resolve } from "node:path";
import postgres from "postgres";

process.loadEnvFile(resolve(process.cwd(), ".env"));
const sql = postgres(process.env.DATABASE_URL!);

const stats = await sql`
  SELECT
    vr.drep_id,
    COUNT(*)::int AS total_rationales,
    COUNT(*) FILTER (WHERE vr.hash_verified = true)::int AS hash_verified_count,
    COUNT(*) FILTER (WHERE vr.hash_verified = false)::int AS hash_failed_count,
    COUNT(*) FILTER (WHERE vr.ai_summary IS NOT NULL)::int AS ai_summarized_count,
    AVG(LENGTH(vr.rationale_text))::int AS avg_rationale_length
  FROM vote_rationales vr
  GROUP BY vr.drep_id
`;

await sql.end();
process.stdout.write(JSON.stringify(stats));
