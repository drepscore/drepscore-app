export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SELF_HEAL_REGISTRY } from '@/lib/selfHeal/registry';
import type {
  SelfHealActionRecord,
  SelfHealClassStats,
  SystemsLaunchDecision,
  SystemsProvenanceStamp,
  SystemsSelfHealViewData,
  SystemsStatus,
  SystemsWorkspaceSummary,
} from '@/lib/admin/systems';
import type { SelfHealClassName } from '@/lib/selfHeal/types';

const RECENT_LIMIT = 100;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

type SelfHealActionRow = {
  id: number;
  class: SelfHealClassName;
  signal: Record<string, unknown> | null;
  action: string;
  started_at: string;
  finished_at: string | null;
  success: boolean | null;
  escalated: boolean;
  detail: Record<string, unknown> | null;
};

function toRecord(row: SelfHealActionRow): SelfHealActionRecord {
  return {
    id: row.id,
    class: row.class,
    signal: row.signal ?? {},
    action: row.action,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    success: row.success,
    escalated: row.escalated,
    detail: row.detail,
  };
}

function statusFromRows(rows: SelfHealActionRow[]): SystemsStatus {
  const now = Date.now();
  const recent = rows.filter((row) => now - Date.parse(row.started_at) < DAY_MS);
  if (recent.some((row) => row.escalated && row.success !== true)) return 'critical';
  if (recent.some((row) => row.success === false)) return 'warning';
  return 'good';
}

function decisionForStatus(status: SystemsStatus): SystemsLaunchDecision {
  if (status === 'critical') return 'blocked';
  if (status === 'warning') return 'risky';
  return 'ready';
}

function computeClassStats(
  registry: ReadonlyArray<SelfHealClassName>,
  rows: SelfHealActionRow[],
): SelfHealClassStats[] {
  const now = Date.now();
  return registry.map((className) => {
    const classRows = rows.filter((row) => row.class === className);
    const last24h = classRows.filter((row) => now - Date.parse(row.started_at) < DAY_MS).length;
    const last7d = classRows.filter((row) => now - Date.parse(row.started_at) < WEEK_MS).length;

    const decided = classRows.filter((row) => row.success !== null);
    const successCount = decided.filter((row) => row.success === true).length;
    const successRate = decided.length === 0 ? 1 : successCount / decided.length;

    const lastFiredAt = classRows[0]?.started_at ?? null;

    return { class: className, last24h, last7d, successRate, lastFiredAt };
  });
}

function buildSummary(input: {
  generatedAt: string;
  status: SystemsStatus;
  rowCount: number;
  registeredCount: number;
}): SystemsWorkspaceSummary {
  const proofStamp: SystemsProvenanceStamp = {
    kind: input.rowCount > 0 ? 'durable_record' : 'stale',
    label: input.rowCount > 0 ? 'self-heal-actions' : 'no-self-heal-actions',
    freshnessLabel:
      input.rowCount > 0
        ? `${input.rowCount} action(s) recorded in the last window`
        : 'No self-heal actions recorded yet',
    updatedAt: input.generatedAt,
    isStale: input.rowCount === 0,
    detail: `${input.registeredCount} registered class(es)`,
  };

  return {
    generatedAt: input.generatedAt,
    section: 'self-heal',
    launchDecision: decisionForStatus(input.status),
    launchHeadline:
      input.status === 'good'
        ? 'Self-heal classes are running clean.'
        : input.status === 'critical'
          ? 'A self-heal class escalated without resolving — investigate.'
          : 'A self-heal class reported a non-success — investigate.',
    blockerCount: input.status === 'critical' ? 1 : 0,
    queueCount: input.status === 'warning' ? 1 : 0,
    proofFreshness:
      input.rowCount > 0
        ? `${input.rowCount} of the last ${RECENT_LIMIT} self-heal actions inspected.`
        : 'Self-heal walker is registered but no actions have fired yet.',
    proofStatus: input.status,
    proofStamps: [proofStamp],
  };
}

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('self_heal_actions')
      .select('id, class, signal, action, started_at, finished_at, success, escalated, detail')
      .order('started_at', { ascending: false })
      .limit(RECENT_LIMIT);

    if (error) {
      return NextResponse.json(
        { error: `Failed to load self-heal actions: ${error.message}` },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as SelfHealActionRow[];
    const registeredClasses = SELF_HEAL_REGISTRY.map((cls) => cls.className);
    const status = statusFromRows(rows);

    return NextResponse.json({
      summary: buildSummary({
        generatedAt: new Date().toISOString(),
        status,
        rowCount: rows.length,
        registeredCount: registeredClasses.length,
      }),
      recentActions: rows.map(toRecord),
      classStats: computeClassStats(registeredClasses, rows),
      registeredClasses,
    } satisfies SystemsSelfHealViewData);
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
