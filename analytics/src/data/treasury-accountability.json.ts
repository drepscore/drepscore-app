import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const polls = await sql`
  SELECT
    p.proposal_tx_hash,
    p.proposal_index,
    p.cycle_number,
    p.opened_epoch,
    p.closes_epoch,
    p.status,
    p.results_summary,
    p.next_cycle_epoch,
    p.created_at,
    pr.title AS proposal_title,
    pr.withdrawal_amount,
    pr.treasury_tier
  FROM treasury_accountability_polls p
  LEFT JOIN proposals pr
    ON pr.tx_hash = p.proposal_tx_hash AND pr.proposal_index = p.proposal_index
  ORDER BY p.created_at DESC
  LIMIT 200
`;

const responses = await sql`
  SELECT
    delivered_rating,
    would_approve_again,
    COUNT(*)::int AS count
  FROM treasury_accountability_responses
  GROUP BY delivered_rating, would_approve_again
  ORDER BY count DESC
`;

const responsesByProposal = await sql`
  SELECT
    proposal_tx_hash,
    proposal_index,
    cycle_number,
    delivered_rating,
    COUNT(*)::int AS count
  FROM treasury_accountability_responses
  GROUP BY proposal_tx_hash, proposal_index, cycle_number, delivered_rating
  ORDER BY count DESC
`;

await sql.end();
process.stdout.write(JSON.stringify({ polls, responses, responsesByProposal }));
