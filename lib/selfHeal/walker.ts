/**
 * Self-heal walker.
 *
 * Iterates the registry and runs each class with per-class isolation:
 * one class failing doesn't break the others. Used by
 * `inngest/functions/sync-freshness-guard.ts`. The same walker is the entry
 * point for unit tests — pass a mock step + recorder.
 */

import { logger } from '@/lib/logger';
import { createSupabaseRecorder } from './audit';
import { SELF_HEAL_REGISTRY } from './registry';
import type {
  SelfHealClass,
  SelfHealClassName,
  SelfHealRecorder,
  SelfHealRunResult,
  SelfHealStep,
} from './types';

export interface RunWalkerOptions {
  step: SelfHealStep;
  /** Restrict to a subset of classes (useful in tests). */
  only?: ReadonlyArray<SelfHealClassName>;
  /** Override the recorder factory (tests pass an in-memory recorder). */
  recorderFor?: (className: SelfHealClassName) => SelfHealRecorder;
  /** Override the registry (tests). */
  registry?: ReadonlyArray<SelfHealClass>;
}

export async function runSelfHealWalker(options: RunWalkerOptions): Promise<SelfHealRunResult[]> {
  const registry = options.registry ?? SELF_HEAL_REGISTRY;
  const onlySet = options.only ? new Set(options.only) : null;
  const recorderFor = options.recorderFor ?? createSupabaseRecorder;
  const results: SelfHealRunResult[] = [];

  for (const cls of registry) {
    if (onlySet && !onlySet.has(cls.className)) continue;

    try {
      const result = await cls.run({
        step: options.step,
        recorder: recorderFor(cls.className),
      });
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[SelfHeal] Class threw — isolated', {
        className: cls.className,
        error: message,
      });
      results.push({
        className: cls.className,
        actions: 0,
        details: [],
        error: message,
      });
    }
  }

  return results;
}
