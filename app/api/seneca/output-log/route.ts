import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';
import { insertSenecaOutput } from '@/lib/seneca/outputLog';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  intent: z.enum(['observational', 'interrogative', 'mechanical']),
  outputText: z.string().min(1).max(4000),
  source: z.enum([
    'idle_briefing',
    'region_suggestion',
    'mechanical_answer',
    'observation_emitted',
    'evergreen_fallback',
  ]),
  userContextHash: z
    .string()
    .regex(/^[a-f0-9]{16}$/u)
    .nullable()
    .optional(),
  cinematicState: z.string().min(1).max(80).nullable().optional(),
});

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = bodySchema.parse(await request.json());
    const result = await insertSenecaOutput({
      intent: body.intent,
      outputText: body.outputText,
      source: body.source,
      userContextHash: body.userContextHash ?? null,
      cinematicState: body.cinematicState ?? null,
    });

    if (!result.ok) {
      // Best-effort telemetry: a persistence failure must not surface as 5xx
      // (it spams error logs and reads as an outage). Log the cause, accept 202.
      logger.warn('Seneca output log not persisted', {
        context: 'api/seneca/output-log',
        source: body.source,
        error: result.error,
      });
      return NextResponse.json({ ok: false, persisted: false }, { status: 202 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  },
  {
    auth: 'optional',
    rateLimit: {
      max: 60,
      window: 60,
    },
  },
);
