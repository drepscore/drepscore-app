import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

interface Alert {
  level: 'critical' | 'warning';
  metric: string;
  value: string;
  threshold: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ skipped: true, reason: 'No webhook URL configured' });
  }

  const supabase = createClient();
  const alerts: Alert[] = [];

  const [
    { data: vpc },
    { data: hv },
    { data: ai },
    { data: sh },
  ] = await Promise.all([
    supabase.from('v_vote_power_coverage').select('*').single(),
    supabase.from('v_hash_verification').select('*').single(),
    supabase.from('v_ai_summary_coverage').select('*').single(),
    supabase.from('v_sync_health').select('*'),
  ]);

  if (vpc && parseFloat(vpc.coverage_pct) < 95) {
    alerts.push({ level: 'critical', metric: 'Vote power coverage', value: `${vpc.coverage_pct}%`, threshold: '95%' });
  }

  if (hv && parseFloat(hv.mismatch_rate_pct) > 5) {
    alerts.push({ level: 'warning', metric: 'Hash mismatch rate', value: `${hv.mismatch_rate_pct}%`, threshold: '5%' });
  }

  if (ai && ai.proposals_with_abstract > 0) {
    const pct = Math.round(ai.proposals_with_summary / ai.proposals_with_abstract * 100);
    if (pct < 90) {
      alerts.push({ level: 'warning', metric: 'Proposal AI summary coverage', value: `${pct}%`, threshold: '90%' });
    }
  }

  const now = Date.now();
  for (const row of sh || []) {
    if (!row.last_run) continue;
    const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60000);
    if (row.sync_type === 'fast' && staleMins > 90) {
      alerts.push({ level: 'critical', metric: 'Fast sync stale', value: `${staleMins}m`, threshold: '90m' });
    }
    if (row.sync_type === 'full' && staleMins > 1560) {
      alerts.push({ level: 'critical', metric: 'Full sync stale', value: `${Math.round(staleMins / 60)}h`, threshold: '26h' });
    }
    if (row.last_success === false) {
      alerts.push({ level: 'critical', metric: `${row.sync_type} sync failed`, value: row.last_error || 'Unknown error', threshold: 'success' });
    }
  }

  // ── Self-healing: trigger stale+failed syncs ────────────────────────────────

  const recoveries: string[] = [];
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

  if (cronSecret && baseUrl) {
    for (const row of sh || []) {
      if (!row.last_run || row.last_success !== false) continue;
      const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60000);
      const isStale = (row.sync_type === 'fast' && staleMins > 90)
        || (row.sync_type === 'full' && staleMins > 1560);
      if (!isStale) continue;

      const syncPath = row.sync_type === 'fast' ? '/api/sync/fast' : '/api/sync';
      try {
        console.log(`[AlertCron] Self-healing: triggering ${row.sync_type} sync recovery`);
        const res = await fetch(`${baseUrl}${syncPath}?secret=${cronSecret}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        recoveries.push(`${row.sync_type}: ${res.status}`);
        console.log(`[AlertCron] Recovery ${row.sync_type} triggered: ${res.status}`);
      } catch (err) {
        recoveries.push(`${row.sync_type}: failed`);
        console.warn(`[AlertCron] Recovery ${row.sync_type} trigger failed:`, err instanceof Error ? err.message : err);
      }
    }
  }

  if (alerts.length === 0) {
    try {
      await supabase.from('sync_log').insert({
        sync_type: 'integrity_check', started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(), duration_ms: 0, success: true,
        metrics: { alerts: 0, recoveries },
      });
    } catch { /* best-effort */ }
    return NextResponse.json({ alerts: 0, sent: false, recoveries });
  }

  const criticals = alerts.filter(a => a.level === 'critical');
  const warnings = alerts.filter(a => a.level === 'warning');

  const isSlack = webhookUrl.includes('hooks.slack.com');

  let body: unknown;
  if (isSlack) {
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `DRepScore Integrity: ${criticals.length} critical, ${warnings.length} warning` },
      },
      ...alerts.map(a => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${a.level === 'critical' ? ':red_circle:' : ':large_yellow_circle:'} *${a.metric}*: ${a.value} (threshold: ${a.threshold})`,
        },
      })),
    ];
    body = { blocks };
  } else {
    const lines = alerts.map(a =>
      `${a.level === 'critical' ? '🔴' : '🟡'} **${a.metric}**: ${a.value} (threshold: ${a.threshold})`
    );
    body = { content: `**DRepScore Integrity Alert**\n${lines.join('\n')}` };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Log alert check
    try {
      await supabase.from('sync_log').insert({
        sync_type: 'integrity_check', started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(), duration_ms: 0, success: true,
        metrics: { alerts: alerts.length, webhook_status: res.status },
      });
    } catch { /* best-effort */ }

    // PostHog event
    try {
      const { captureServerEvent } = await import('@/lib/posthog-server');
      captureServerEvent('integrity_alert_sent', {
        alert_count: alerts.length,
        critical_count: criticals.length,
        warning_count: warnings.length,
      });
    } catch { /* optional */ }

    return NextResponse.json({ alerts: alerts.length, sent: res.ok, details: alerts });
  } catch (err) {
    return NextResponse.json({
      alerts: alerts.length, sent: false,
      error: err instanceof Error ? err.message : 'Webhook failed',
    }, { status: 502 });
  }
}
