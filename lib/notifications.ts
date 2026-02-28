/**
 * Notification Engine — channel-agnostic event routing
 * Supports: push, discord, telegram (in-app alerts remain client-side)
 */
import { captureServerEvent } from '@/lib/posthog-server';

import { getSupabaseAdmin } from './supabase';

export type EventType =
  | 'score-change'
  | 'pending-proposals'
  | 'urgent-deadline'
  | 'delegation-change'
  | 'critical-proposal-open'
  | 'profile-view';

export type Channel = 'push' | 'discord' | 'telegram';

export interface NotificationEvent {
  eventType: EventType;
  title: string;
  body: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelTarget {
  channel: Channel;
  channelIdentifier: string;
  config: Record<string, unknown>;
  userWallet: string;
}

// ── Channel Senders ─────────────────────────────────────────────────────────

async function sendDiscordWebhook(
  webhookUrl: string,
  event: NotificationEvent
): Promise<boolean> {
  try {
    const color = event.eventType === 'urgent-deadline' || event.eventType === 'critical-proposal-open'
      ? 0xff4444
      : event.eventType === 'score-change'
      ? 0x22c55e
      : 0x3b82f6;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: event.title,
          description: event.body,
          color,
          url: event.url,
          footer: { text: 'DRepScore' },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendTelegramMessage(
  chatId: string,
  event: NotificationEvent
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  try {
    let text = `*${escapeMarkdown(event.title)}*\n${escapeMarkdown(event.body)}`;
    if (event.url) text += `\n[View on DRepScore](${event.url})`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

const CHANNEL_SENDERS: Record<Channel, (target: ChannelTarget, event: NotificationEvent) => Promise<boolean>> = {
  discord: (target, event) => sendDiscordWebhook(target.channelIdentifier, event),
  telegram: (target, event) => sendTelegramMessage(target.channelIdentifier, event),
  push: async () => false, // Handled by existing push infrastructure
};

// ── Core Router ─────────────────────────────────────────────────────────────

/**
 * Send a notification event to all subscribed channels for a user.
 */
export async function notifyUser(
  userWallet: string,
  event: NotificationEvent
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('channel')
    .eq('user_wallet', userWallet)
    .eq('event_type', event.eventType)
    .eq('enabled', true);

  if (!prefs || prefs.length === 0) return;

  const enabledChannels = new Set(prefs.map(p => p.channel as Channel));

  const { data: channels } = await supabase
    .from('user_channels')
    .select('*')
    .eq('user_wallet', userWallet);

  if (!channels) return;

  for (const ch of channels) {
    if (!enabledChannels.has(ch.channel as Channel)) continue;

    const sender = CHANNEL_SENDERS[ch.channel as Channel];
    if (!sender) continue;

    const target: ChannelTarget = {
      channel: ch.channel,
      channelIdentifier: ch.channel_identifier,
      config: ch.config || {},
      userWallet,
    };

    const sent = await sender(target, event);

    captureServerEvent('notification_sent', {
      channel: ch.channel,
      event_type: event.eventType,
      delivered: sent,
    }, userWallet);

    await supabase.from('notification_log').insert({
      user_wallet: userWallet,
      event_type: event.eventType,
      channel: ch.channel,
      payload: { ...event.metadata, sent },
    });
  }
}

/**
 * Broadcast an event to a Discord webhook (server-wide, not per-user).
 * Used for public channel announcements.
 */
export async function broadcastDiscord(event: NotificationEvent): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false;
  return sendDiscordWebhook(webhookUrl, event);
}

/**
 * Send notifications to all users who have a specific event type enabled on any channel.
 */
export async function broadcastEvent(event: NotificationEvent): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_wallet, channel')
    .eq('event_type', event.eventType)
    .eq('enabled', true);

  if (!prefs || prefs.length === 0) return 0;

  const userChannelPairs = new Map<string, Set<Channel>>();
  for (const p of prefs) {
    if (!userChannelPairs.has(p.user_wallet)) {
      userChannelPairs.set(p.user_wallet, new Set());
    }
    userChannelPairs.get(p.user_wallet)!.add(p.channel as Channel);
  }

  let sent = 0;
  for (const [wallet, channels] of userChannelPairs) {
    const { data: userChannels } = await supabase
      .from('user_channels')
      .select('*')
      .eq('user_wallet', wallet);

    if (!userChannels) continue;

    for (const ch of userChannels) {
      if (!channels.has(ch.channel as Channel)) continue;

      const sender = CHANNEL_SENDERS[ch.channel as Channel];
      if (!sender) continue;

      const target: ChannelTarget = {
        channel: ch.channel,
        channelIdentifier: ch.channel_identifier,
        config: ch.config || {},
        userWallet: wallet,
      };

      const ok = await sender(target, event);
      if (ok) sent++;

      await supabase.from('notification_log').insert({
        user_wallet: wallet,
        event_type: event.eventType,
        channel: ch.channel,
        payload: { ...event.metadata, sent: ok },
      });
    }
  }

  return sent;
}
