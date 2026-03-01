import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const polls = await sql`
  SELECT
    pr.proposal_tx_hash,
    pr.proposal_index,
    pr.vote AS user_vote,
    pr.delegated_drep_id,
    pr.created_at,
    COALESCE(pr.source, 'organic') AS source,
    p.title AS proposal_title,
    p.proposal_type,
    dv.vote AS drep_vote
  FROM poll_responses pr
  LEFT JOIN proposals p
    ON pr.proposal_tx_hash = p.tx_hash
    AND pr.proposal_index = p.proposal_index
  LEFT JOIN drep_votes dv
    ON pr.proposal_tx_hash = dv.proposal_tx_hash
    AND pr.proposal_index = dv.proposal_index
    AND pr.delegated_drep_id = dv.drep_id
  ORDER BY pr.created_at DESC
`;

await sql.end();
process.stdout.write(JSON.stringify(polls));
