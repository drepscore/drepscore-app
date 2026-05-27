/**
 * Self-heal audit log writer.
 *
 * Each class fires through this recorder so `self_heal_actions` reflects every
 * mitigation attempt. The cockpit at `/admin/systems/self-heal` reads from
 * the same table.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { SelfHealClassName, SelfHealRecorder, SelfHealRecordInput } from './types';

export function createSupabaseRecorder(className: SelfHealClassName): SelfHealRecorder {
  return {
    async record(input: SelfHealRecordInput): Promise<void> {
      try {
        const supabase = getSupabaseAdmin();
        const startedAt = input.startedAt ?? new Date().toISOString();
        const finishedAt = new Date().toISOString();
        const { error } = await supabase.from('self_heal_actions').insert({
          class: className,
          signal: input.signal,
          action: input.action,
          started_at: startedAt,
          finished_at: finishedAt,
          success: input.success,
          escalated: input.escalated ?? false,
          detail: input.detail ?? null,
        });

        if (error) {
          logger.warn('[SelfHeal] Failed to record audit row', {
            className,
            action: input.action,
            error: error.message,
          });
        }
      } catch (error) {
        logger.warn('[SelfHeal] Failed to record audit row', {
          className,
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
