import { resolve } from "node:path";
import { existsSync } from "node:fs";
import postgres from "postgres";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const sql = postgres(process.env.DATABASE_URL!);

const emailNotifications = await sql`
  SELECT
    event_type,
    channel,
    payload->>'sent' AS delivered,
    created_at
  FROM notification_log
  WHERE channel = 'email'
  ORDER BY created_at DESC
  LIMIT 1000
`;

const emailUsers = await sql`
  SELECT
    COUNT(*) FILTER (WHERE email IS NOT NULL) AS with_email,
    COUNT(*) FILTER (WHERE email_verified = true) AS verified,
    COUNT(*) FILTER (WHERE digest_frequency = 'off') AS unsubscribed,
    COUNT(*) FILTER (WHERE digest_frequency = 'weekly') AS weekly,
    COUNT(*) FILTER (WHERE digest_frequency = 'biweekly') AS biweekly,
    COUNT(*) FILTER (WHERE digest_frequency = 'monthly') AS monthly
  FROM users
`;

await sql.end();
process.stdout.write(JSON.stringify({
  notifications: emailNotifications,
  userStats: emailUsers[0],
}));
