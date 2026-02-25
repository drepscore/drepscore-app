import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { bech32 } from 'bech32';

export const dynamic = 'force-dynamic';

function deriveStakeFromPaymentAddress(paymentAddress: string): string | null {
  try {
    const decoded = bech32.decode(paymentAddress, 256);
    if (decoded.prefix !== 'addr' && decoded.prefix !== 'addr_test') return null;
    const data = bech32.fromWords(decoded.words);
    if (data.length !== 57) return null;
    const headerByte = data[0];
    if (((headerByte & 0xf0) >> 4) > 3) return null;
    const networkId = headerByte & 0x0f;
    const stakeKeyHash = data.slice(29);
    const stakeBytes = new Uint8Array(1 + stakeKeyHash.length);
    stakeBytes[0] = 0xe0 | networkId;
    stakeBytes.set(stakeKeyHash, 1);
    return bech32.encode(networkId === 1 ? 'stake' : 'stake_test', bech32.toWords(stakeBytes), 256);
  } catch { return null; }
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret && secret === process.env.CRON_SECRET) return true;

  const address = searchParams.get('address');
  if (!address) return false;
  const adminWallets = (process.env.ADMIN_WALLETS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const lower = address.toLowerCase();
  if (adminWallets.includes(lower)) return true;
  const stakeAddr = deriveStakeFromPaymentAddress(lower);
  return !!(stakeAddr && adminWallets.includes(stakeAddr.toLowerCase()));
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const [
    votePower,
    aiSummary,
    hashVerify,
    metaVerify,
    canonicalSummary,
    syncHealth,
    systemStats,
  ] = await Promise.all([
    supabase.from('v_vote_power_coverage').select('*').single(),
    supabase.from('v_ai_summary_coverage').select('*').single(),
    supabase.from('v_hash_verification').select('*').single(),
    supabase.from('v_metadata_verification').select('*').single(),
    supabase.from('v_canonical_summary_coverage').select('*').single(),
    supabase.from('v_sync_health').select('*'),
    supabase.from('v_system_stats').select('*').single(),
  ]);

  // Recent sync history (last 20)
  const { data: syncHistory } = await supabase.from('sync_log')
    .select('id, sync_type, started_at, finished_at, duration_ms, success, error_message')
    .order('started_at', { ascending: false })
    .limit(20);

  const now = new Date();
  const syncHealthMap: Record<string, unknown> = {};
  for (const row of syncHealth.data || []) {
    const lastRun = row.last_run ? new Date(row.last_run) : null;
    const staleMins = lastRun ? Math.round((now.getTime() - lastRun.getTime()) / 60000) : null;
    syncHealthMap[row.sync_type] = { ...row, stale_minutes: staleMins };
  }

  const alerts: { level: 'critical' | 'warning'; metric: string; value: string; threshold: string }[] = [];

  const vpc = votePower.data;
  if (vpc && parseFloat(vpc.coverage_pct) < 95) {
    alerts.push({ level: 'critical', metric: 'Vote power coverage', value: `${vpc.coverage_pct}%`, threshold: '95%' });
  }

  const hv = hashVerify.data;
  if (hv && parseFloat(hv.mismatch_rate_pct) > 5) {
    alerts.push({ level: 'warning', metric: 'Hash mismatch rate', value: `${hv.mismatch_rate_pct}%`, threshold: '5%' });
  }

  const ai = aiSummary.data;
  if (ai && ai.proposals_with_abstract > 0) {
    const pct = Math.round(ai.proposals_with_summary / ai.proposals_with_abstract * 100);
    if (pct < 90) {
      alerts.push({ level: 'warning', metric: 'Proposal AI summary coverage', value: `${pct}%`, threshold: '90%' });
    }
  }

  const fastSync = syncHealthMap['fast'] as Record<string, unknown> | undefined;
  if (fastSync && typeof fastSync.stale_minutes === 'number' && fastSync.stale_minutes > 90) {
    alerts.push({ level: 'critical', metric: 'Fast sync stale', value: `${fastSync.stale_minutes} min`, threshold: '90 min' });
  }

  const fullSync = syncHealthMap['full'] as Record<string, unknown> | undefined;
  if (fullSync && typeof fullSync.stale_minutes === 'number' && fullSync.stale_minutes > 1560) {
    alerts.push({ level: 'critical', metric: 'Full sync stale', value: `${Math.round(fullSync.stale_minutes / 60)} hr`, threshold: '26 hr' });
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    vote_power: votePower.data,
    ai_summaries: aiSummary.data,
    hash_verification: hashVerify.data,
    metadata_verification: metaVerify.data,
    canonical_summaries: canonicalSummary.data,
    sync_health: syncHealthMap,
    system_stats: systemStats.data,
    sync_history: syncHistory || [],
    alerts,
  });
}
