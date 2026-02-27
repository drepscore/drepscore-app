import { resolve } from "node:path";
import postgres from "postgres";

process.loadEnvFile(resolve(process.cwd(), ".env"));
const sql = postgres(process.env.DATABASE_URL!);

const dreps = await sql`
  SELECT
    id AS drep_id,
    (info->>'name')::text AS name,
    score,
    participation_rate,
    rationale_rate,
    reliability_score,
    reliability_streak,
    reliability_recency,
    reliability_longest_gap,
    reliability_tenure,
    profile_completeness,
    effective_participation,
    deliberation_modifier,
    size_tier,
    (info->>'votingPower')::numeric AS voting_power,
    (info->>'delegatorCount')::int AS delegator_count,
    (info->>'totalVotes')::int AS total_votes,
    (info->>'isActive')::boolean AS is_active,
    alignment_treasury_conservative,
    alignment_treasury_growth,
    alignment_decentralization,
    alignment_security,
    alignment_innovation,
    alignment_transparency,
    last_vote_time,
    metadata_hash_verified,
    updated_at
  FROM dreps
  WHERE (info->>'isActive')::boolean = true
  ORDER BY score DESC
`;

await sql.end();
process.stdout.write(JSON.stringify(dreps));
