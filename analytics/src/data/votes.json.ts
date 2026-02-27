import { resolve } from "node:path";
import postgres from "postgres";

process.loadEnvFile(resolve(process.cwd(), ".env"));
const sql = postgres(process.env.DATABASE_URL!);

const votes = await sql`
  SELECT
    v.drep_id,
    v.vote,
    v.proposal_tx_hash,
    v.proposal_index,
    v.block_time,
    v.epoch_no,
    v.meta_url,
    v.voting_power_lovelace,
    p.proposal_type,
    p.title
  FROM drep_votes v
  LEFT JOIN proposals p
    ON v.proposal_tx_hash = p.tx_hash
    AND v.proposal_index = p.proposal_index
  ORDER BY v.block_time DESC
`;

await sql.end();
process.stdout.write(JSON.stringify(votes));
