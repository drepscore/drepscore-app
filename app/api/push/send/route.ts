/**
 * Push Notification Send API
 * Sends web push notifications to subscribed users.
 * Called by the sync cron or can be triggered manually for testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push');

export const dynamic = 'force-dynamic';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@drepscore.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendToSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
): Promise<{ success: boolean; expired?: boolean }> {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      { TTL: 86400 },
    );
    return { success: true };
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      return { success: false, expired: true };
    }
    console.error('[Push] Send error:', err?.statusCode, err?.message);
    return { success: false };
  }
}

export async function POST(request: NextRequest) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { type } = body as { type: string };

    const supabase = createClient();

    // Fetch all users with push subscriptions
    const { data: users, error } = await supabase
      .from('users')
      .select('wallet_address, push_subscriptions, claimed_drep_id')
      .not('push_subscriptions', 'eq', '{}');

    if (error || !users) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const subscribedUsers = users.filter(
      (u: any) => u.push_subscriptions?.endpoint && u.push_subscriptions?.keys
    );

    if (subscribedUsers.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscribed users' });
    }

    let payload: PushPayload;
    let targetUsers = subscribedUsers;

    switch (type) {
      case 'critical-proposal-open': {
        const { proposalTitle, txHash, index } = body;
        payload = {
          title: 'Critical Governance Proposal',
          body: proposalTitle
            ? `"${proposalTitle}" is open for voting. This is a high-impact proposal.`
            : 'A critical governance proposal is now open for voting.',
          url: txHash ? `/proposals/${txHash}/${index || 0}` : '/proposals',
          tag: `critical-${txHash || 'unknown'}`,
        };
        break;
      }

      case 'drep-pending-proposals': {
        const { pendingCount, criticalCount } = body;
        targetUsers = subscribedUsers.filter((u: any) => u.claimed_drep_id);
        payload = {
          title: criticalCount > 0
            ? `${criticalCount} critical proposal${criticalCount !== 1 ? 's' : ''} need your vote`
            : `${pendingCount} proposal${pendingCount !== 1 ? 's' : ''} awaiting your vote`,
          body: 'Open your DRep dashboard to review and vote.',
          url: '/dashboard/inbox',
          tag: 'drep-pending',
        };
        break;
      }

      case 'test': {
        payload = {
          title: 'DRepScore Test Notification',
          body: 'Push notifications are working!',
          url: '/',
          tag: 'test',
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    let sent = 0;
    let expired = 0;
    const expiredAddresses: string[] = [];

    for (const user of targetUsers) {
      const result = await sendToSubscription(user.push_subscriptions, payload);
      if (result.success) {
        sent++;
      } else if (result.expired) {
        expired++;
        expiredAddresses.push(user.wallet_address);
      }
    }

    // Clean up expired subscriptions
    if (expiredAddresses.length > 0) {
      for (const addr of expiredAddresses) {
        await supabase
          .from('users')
          .update({ push_subscriptions: {} })
          .eq('wallet_address', addr);
      }
    }

    return NextResponse.json({
      sent,
      expired,
      total: targetUsers.length,
    });
  } catch (err) {
    console.error('[Push API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
