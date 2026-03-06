import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function logAdminAction(
  userId: string,
  action: string,
  target?: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('admin_audit_log').insert({
      user_id: userId,
      action,
      target: target ?? null,
      payload: payload ?? null,
    });
  } catch (error) {
    logger.error('Failed to log admin action', { action, target, error });
  }
}
