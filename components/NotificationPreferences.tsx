'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/pushSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell,
  BellOff,
  Loader2,
  MessageCircle,
  Hash,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

type Channel = 'push' | 'telegram' | 'discord';
type EventType = 'score-change' | 'pending-proposals' | 'urgent-deadline' | 'delegation-change' | 'critical-proposal-open';

const EVENT_LABELS: Record<EventType, string> = {
  'score-change': 'Score Changes',
  'pending-proposals': 'New Pending Proposals',
  'urgent-deadline': 'Urgent Deadlines',
  'delegation-change': 'Delegation Changes',
  'critical-proposal-open': 'Critical Proposals',
};

const ALL_EVENTS: EventType[] = Object.keys(EVENT_LABELS) as EventType[];

interface ChannelState {
  connected: boolean;
  identifier: string;
}

interface PrefState {
  [key: string]: boolean; // `${channel}:${eventType}` -> enabled
}

export function NotificationPreferences() {
  const { connected, isAuthenticated, sessionAddress } = useWallet();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Record<Channel, ChannelState>>({
    push: { connected: false, identifier: '' },
    telegram: { connected: false, identifier: '' },
    discord: { connected: false, identifier: '' },
  });
  const [prefs, setPrefs] = useState<PrefState>({});
  const [pushToggling, setPushToggling] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [discordUrl, setDiscordUrl] = useState('');
  const [discordSaving, setDiscordSaving] = useState(false);
  const [telegramConnecting, setTelegramConnecting] = useState(false);

  const token = getStoredSession();

  // Auto-complete Telegram connect when visiting with ?telegram_connect=TOKEN
  useEffect(() => {
    const connectToken = searchParams.get('telegram_connect');
    if (!connectToken || !token || telegramConnecting) return;

    setTelegramConnecting(true);
    fetch('/api/telegram/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: connectToken }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setChannels(prev => ({ ...prev, telegram: { connected: true, identifier: 'connected' } }));
          window.history.replaceState({}, '', '/profile');
        }
      })
      .catch(() => {})
      .finally(() => setTelegramConnecting(false));
  }, [searchParams, token, telegramConnecting]);

  const loadData = useCallback(async () => {
    if (!token) { setLoading(false); return; }

    try {
      const pushSub = await isPushSubscribed();

      const [channelsRes, prefsRes] = await Promise.all([
        fetch('/api/user/channels', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/user/notification-prefs', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const channelsData: Array<{ channel: string; channel_identifier: string }> = channelsRes.ok ? await channelsRes.json() : [];
      const prefsData: Array<{ channel: string; event_type: string; enabled: boolean }> = prefsRes.ok ? await prefsRes.json() : [];

      const newChannels: Record<Channel, ChannelState> = {
        push: { connected: pushSub, identifier: 'browser' },
        telegram: { connected: false, identifier: '' },
        discord: { connected: false, identifier: '' },
      };
      for (const ch of channelsData) {
        if (ch.channel === 'telegram' || ch.channel === 'discord') {
          newChannels[ch.channel] = { connected: true, identifier: ch.channel_identifier };
        }
      }
      setChannels(newChannels);

      const newPrefs: PrefState = {};
      for (const p of prefsData) {
        newPrefs[`${p.channel}:${p.event_type}`] = p.enabled;
      }
      setPrefs(newPrefs);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePushToggle = async () => {
    if (!token) return;
    setPushToggling(true);
    setPushError(null);
    try {
      if (channels.push.connected) {
        await unsubscribeFromPush(token);
        setChannels(prev => ({ ...prev, push: { connected: false, identifier: '' } }));
      } else {
        if (!('Notification' in window)) { setPushError('Browser does not support notifications'); return; }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { setPushError('Permission denied'); return; }
        const ok = await subscribeToPush(token);
        if (!ok) { setPushError('Failed to subscribe'); return; }
        setChannels(prev => ({ ...prev, push: { connected: true, identifier: 'browser' } }));
      }
    } finally {
      setPushToggling(false);
    }
  };

  const handleDiscordConnect = async () => {
    if (!token || !discordUrl.startsWith('https://discord.com/api/webhooks/')) return;
    setDiscordSaving(true);
    try {
      const res = await fetch('/api/user/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel: 'discord', channelIdentifier: discordUrl }),
      });
      if (res.ok) {
        setChannels(prev => ({ ...prev, discord: { connected: true, identifier: discordUrl } }));
        setDiscordUrl('');
      }
    } finally {
      setDiscordSaving(false);
    }
  };

  const handleDisconnectChannel = async (channel: Channel) => {
    if (!token) return;
    await fetch('/api/user/channels', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel }),
    });
    setChannels(prev => ({ ...prev, [channel]: { connected: false, identifier: '' } }));
  };

  const handlePrefToggle = async (channel: Channel, eventType: EventType) => {
    if (!token) return;
    const key = `${channel}:${eventType}`;
    const newEnabled = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newEnabled }));

    await fetch('/api/user/notification-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, eventType, enabled: newEnabled }),
    });
  };

  if (!isAuthenticated || !connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
          <CardDescription>Connect your wallet to manage notification preferences</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent><Loader2 className="h-5 w-5 animate-spin mx-auto" /></CardContent>
      </Card>
    );
  }

  const connectedChannels = (Object.entries(channels) as Array<[Channel, ChannelState]>).filter(([, s]) => s.connected);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
        <CardDescription>Choose how and when you receive governance alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channel connections */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Channels</p>

          {/* Push */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Browser Push</p>
                <p className="text-[10px] text-muted-foreground">Per-browser, works even when tab is closed</p>
              </div>
            </div>
            <Button variant={channels.push.connected ? 'outline' : 'default'} size="sm" onClick={handlePushToggle} disabled={pushToggling}>
              {pushToggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : channels.push.connected ? <BellOff className="h-3.5 w-3.5 mr-1" /> : <Bell className="h-3.5 w-3.5 mr-1" />}
              {channels.push.connected ? 'Disable' : 'Enable'}
            </Button>
          </div>
          {pushError && <p className="text-xs text-destructive">{pushError}</p>}

          {/* Telegram */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Telegram</p>
                <p className="text-[10px] text-muted-foreground">
                  {channels.telegram.connected ? 'Connected' : 'Message @DRepScoreBot to connect'}
                </p>
              </div>
            </div>
            {channels.telegram.connected ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]"><Check className="h-3 w-3 mr-1" />Connected</Badge>
                <Button variant="ghost" size="sm" onClick={() => handleDisconnectChannel('telegram')}><X className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1" asChild>
                <a href="https://t.me/DRepScoreBot" target="_blank" rel="noopener noreferrer">
                  Connect <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>

          {/* Discord */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Discord Webhook</p>
                  <p className="text-[10px] text-muted-foreground">
                    {channels.discord.connected ? 'Webhook connected' : 'Paste a Discord channel webhook URL'}
                  </p>
                </div>
              </div>
              {channels.discord.connected && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]"><Check className="h-3 w-3 mr-1" />Connected</Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleDisconnectChannel('discord')}><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
            {!channels.discord.connected && (
              <div className="flex gap-2">
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordUrl}
                  onChange={e => setDiscordUrl(e.target.value)}
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleDiscordConnect}
                  disabled={discordSaving || !discordUrl.startsWith('https://discord.com/api/webhooks/')}
                >
                  {discordSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Event type preferences */}
        {connectedChannels.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alert Types</p>
            <div className="space-y-2">
              {ALL_EVENTS.map(eventType => (
                <div key={eventType} className="flex items-center justify-between py-1.5">
                  <span className="text-sm">{EVENT_LABELS[eventType]}</span>
                  <div className="flex gap-1.5">
                    {connectedChannels.map(([channel]) => {
                      const key = `${channel}:${eventType}`;
                      const enabled = prefs[key] !== false;
                      return (
                        <button
                          key={channel}
                          onClick={() => handlePrefToggle(channel, eventType)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            enabled
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                          title={`${enabled ? 'Disable' : 'Enable'} ${EVENT_LABELS[eventType]} on ${channel}`}
                        >
                          {channel === 'push' && <Bell className="h-2.5 w-2.5" />}
                          {channel === 'telegram' && <MessageCircle className="h-2.5 w-2.5" />}
                          {channel === 'discord' && <Hash className="h-2.5 w-2.5" />}
                          {channel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
