/**
 * Email Sender — Resend integration with React Email templates.
 *
 * Wires itself into the notification engine as the 'email' channel sender.
 * Reads users.email + users.email_verified from Supabase.
 */

import { Resend } from 'resend';
import React from 'react';

import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';

import { type NotificationPayload, renderEmail } from './channelRenderers';
import { type ChannelTarget, registerChannelSender } from './notifications';
import { getSupabaseAdmin } from './supabase';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'DRepScore <onboarding@resend.dev>';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io';

// ── Core Send ─────────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  react: React.ReactElement,
  options?: { unsubscribeUrl?: string; tags?: Array<{ name: string; value: string }> },
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[Email] RESEND_API_KEY not configured');
    return false;
  }

  try {
    const headers: Record<string, string> = {};
    if (options?.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${options.unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react,
      headers,
      tags: options?.tags,
    });

    if (error) {
      logger.error('[Email] Send error', { error });
      captureServerEvent('email_delivered', {
        template: subject,
        success: false,
        error: error.message,
      });
      return false;
    }

    captureServerEvent('email_delivered', { template: subject, success: true });
    return true;
  } catch (err) {
    logger.error('[Email] Send exception', { error: err });
    return false;
  }
}

// ── Unsubscribe Token ─────────────────────────────────────────────────────────

export function generateUnsubscribeUrl(userId: string): string {
  const token = Buffer.from(
    JSON.stringify({
      u: userId,
      t: Date.now(),
    }),
  ).toString('base64url');
  return `${BASE_URL}/api/user/unsubscribe?token=${token}`;
}

export function parseUnsubscribeToken(token: string): { userId: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    // Support both new `u` key and legacy `w` key
    const userId = decoded.u ?? decoded.w;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

// ── Email Verification Token ────────────────────────────────────────────────

export function generateVerificationUrl(userId: string, email: string): string {
  const token = Buffer.from(
    JSON.stringify({
      u: userId,
      e: email,
      t: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }),
  ).toString('base64url');
  return `${BASE_URL}/api/user/email/verify?token=${token}`;
}

export function parseVerificationToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    // Support both new `u` key and legacy `w` key
    const userId = decoded.u ?? decoded.w;
    if (!userId || !decoded.e) return null;
    if (decoded.exp && Date.now() > decoded.exp) return null;
    return { userId, email: decoded.e };
  } catch {
    return null;
  }
}

// ── Wire into Notification Engine ───────────────────────────────────────────

async function emailChannelSender(
  target: ChannelTarget,
  payload: NotificationPayload,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('email, email_verified')
    .eq('id', target.userId)
    .single();

  if (!user?.email || !user?.email_verified) return false;

  const rendered = renderEmail(payload);
  const unsubscribeUrl = generateUnsubscribeUrl(target.userId);

  const { GenericNotificationEmail } = await import('./emailTemplates');
  const emailElement = React.createElement(GenericNotificationEmail, {
    title: rendered.data.title as string,
    body: rendered.data.body as string,
    url: rendered.data.url as string | undefined,
    unsubscribeUrl,
  });

  return sendEmail(user.email, rendered.subject, emailElement, { unsubscribeUrl });
}

registerChannelSender('email', emailChannelSender);
