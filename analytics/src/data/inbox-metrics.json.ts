import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const currentEpoch = await sql`
  SELECT FLOOR(EXTRACT(EPOCH FROM now()) - 1591566291) / 432000 + 208 AS epoch
`;
const epoch = Math.floor(Number(currentEpoch[0].epoch));

const openProposals = await sql`
  SELECT
    p.proposal_type,
    p.title,
    p.expiration_epoch,
    p.proposed_epoch,
    COALESCE(vs.drep_yes_votes_cast, 0) + COALESCE(vs.drep_no_votes_cast, 0) + COALESCE(vs.drep_abstain_votes_cast, 0) AS total_drep_votes
  FROM proposals p
  LEFT JOIN proposal_voting_summary vs
    ON p.tx_hash = vs.proposal_tx_hash AND p.proposal_index = vs.proposal_index
  WHERE p.enacted_epoch IS NULL
    AND p.ratified_epoch IS NULL
    AND p.dropped_epoch IS NULL
    AND p.expired_epoch IS NULL
  ORDER BY p.block_time DESC
`;

const totalActiveDreps = await sql`
  SELECT COUNT(*) AS count FROM dreps WHERE (info->>'isActive')::boolean = true
`;

const votesThisEpoch = await sql`
  SELECT
    d.id AS drep_id,
    (d.info->>'name')::text AS name,
    d.score,
    COUNT(v.vote_tx_hash) AS votes_this_epoch,
    d.participation_rate,
    (d.info->>'totalVotes')::int AS total_votes
  FROM dreps d
  LEFT JOIN drep_votes v ON d.id = v.drep_id AND v.epoch_no = ${epoch}
  WHERE (d.info->>'isActive')::boolean = true
  GROUP BY d.id, d.info, d.score, d.participation_rate
  ORDER BY d.score DESC
`;

const recentNotifications = await sql`
  SELECT
    event_type,
    channel,
    COUNT(*) AS count,
    COUNT(*) FILTER (WHERE (payload->>'sent')::boolean = true) AS delivered
  FROM notification_log
  WHERE sent_at > now() - interval '7 days'
  GROUP BY event_type, channel
  ORDER BY count DESC
`;

await sql.end();

process.stdout.write(JSON.stringify({
  currentEpoch: epoch,
  totalActiveDreps: Number(totalActiveDreps[0].count),
  openProposals: openProposals.map(p => ({
    ...p,
    epochsRemaining: p.expiration_epoch != null ? Math.max(0, Number(p.expiration_epoch) - epoch) : null,
    total_drep_votes: Number(p.total_drep_votes),
  })),
  drepActivity: votesThisEpoch.map(d => ({
    drepId: d.drep_id,
    name: d.name,
    score: Number(d.score),
    votesThisEpoch: Number(d.votes_this_epoch),
    participationRate: Number(d.participation_rate),
    totalVotes: Number(d.total_votes),
  })),
  notifications: recentNotifications.map(n => ({
    eventType: n.event_type,
    channel: n.channel,
    count: Number(n.count),
    delivered: Number(n.delivered),
  })),
}));
