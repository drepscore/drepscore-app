import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const proposals = await sql`
  SELECT
    p.tx_hash,
    p.proposal_index,
    p.proposal_id,
    p.proposal_type,
    p.title,
    p.abstract,
    p.ai_summary,
    p.withdrawal_amount,
    p.treasury_tier,
    p.proposed_epoch,
    p.expiration_epoch,
    p.ratified_epoch,
    p.enacted_epoch,
    p.dropped_epoch,
    p.expired_epoch,
    p.block_time,
    CASE
      WHEN p.enacted_epoch IS NOT NULL THEN 'enacted'
      WHEN p.ratified_epoch IS NOT NULL THEN 'ratified'
      WHEN p.dropped_epoch IS NOT NULL THEN 'dropped'
      WHEN p.expired_epoch IS NOT NULL THEN 'expired'
      ELSE 'open'
    END AS status,
    vs.drep_yes_votes_cast,
    vs.drep_yes_vote_power,
    vs.drep_no_votes_cast,
    vs.drep_no_vote_power,
    vs.drep_abstain_votes_cast,
    vs.drep_abstain_vote_power
  FROM proposals p
  LEFT JOIN proposal_voting_summary vs
    ON p.tx_hash = vs.proposal_tx_hash
    AND p.proposal_index = vs.proposal_index
  ORDER BY p.block_time DESC
`;

await sql.end();
process.stdout.write(JSON.stringify(proposals));
