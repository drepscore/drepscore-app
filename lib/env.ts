import { z } from 'zod';
import { logger } from './logger';

const requiredEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(1),
});

const optionalEnv = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  KOIOS_API_KEY: z.string().min(1).optional(),
  ADMIN_WALLETS: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
});

const OPTIONAL_KEYS = Object.keys(optionalEnv.shape) as (keyof z.infer<typeof optionalEnv>)[];

export function validateEnv(): void {
  const required = requiredEnv.safeParse(process.env);

  if (!required.success) {
    const missing = required.error.issues.map(
      (i) => `  ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(
      `Missing or invalid required environment variables:\n${missing.join('\n')}`,
    );
  }

  const missing: string[] = [];
  for (const key of OPTIONAL_KEYS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.warn('Optional environment variables not set', {
      context: 'env-validation',
      missing,
    });
  }
}
