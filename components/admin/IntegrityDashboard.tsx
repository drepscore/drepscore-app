'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity,
  Database, Shield, Clock, TrendingUp, Zap,
} from 'lucide-react';

interface IntegrityData {
  timestamp: string;
  vote_power: {
    total_votes: number; with_power: number; null_power: number;
    exact_count: number; nearest_count: number; coverage_pct: string;
  };
  ai_summaries: {
    total_proposals: number; proposals_with_summary: number; proposals_with_abstract: number;
    total_rationales: number; rationales_with_text: number; rationales_with_summary: number;
  };
  hash_verification: {
    rationale_verified: number; rationale_mismatch: number; rationale_pending: number;
    rationale_unreachable: number; mismatch_rate_pct: string;
  };
  metadata_verification: {
    drep_verified: number; drep_mismatch: number; drep_pending: number; drep_with_anchor_hash: number;
  };
  canonical_summaries: {
    total_proposals: number; with_proposal_id: number; with_canonical_summary: number;
  };
  sync_health: Record<string, {
    sync_type: string; last_run: string | null; last_finished: string | null;
    last_duration_ms: number | null; last_success: boolean | null; last_error: string | null;
    success_count: number; failure_count: number; stale_minutes: number | null;
  }>;
  system_stats: {
    total_dreps: number; total_votes: number; total_proposals: number;
    total_rationales: number; total_power_snapshots: number; dreps_with_snapshots: number;
    newest_vote_time: string | null; newest_summary_fetch: string | null;
  };
  sync_history: {
    id: number; sync_type: string; started_at: string; finished_at: string | null;
    duration_ms: number | null; success: boolean; error_message: string | null;
  }[];
  alerts: { level: 'critical' | 'warning'; metric: string; value: string; threshold: string }[];
}

function MetricCard({ title, value, subtitle, icon: Icon, status }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; status?: 'good' | 'warning' | 'critical';
}) {
  const statusColors = {
    good: 'text-green-500',
    warning: 'text-amber-500',
    critical: 'text-red-500',
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${status ? statusColors[status] : ''}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Icon className={`h-4 w-4 mt-0.5 ${status ? statusColors[status] : 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SyncRow({ entry }: { entry: IntegrityData['sync_history'][0] }) {
  const time = new Date(entry.started_at);
  const dur = entry.duration_ms ? `${(entry.duration_ms / 1000).toFixed(1)}s` : '—';
  return (
    <tr className="border-b border-border/50 text-xs">
      <td className="py-1.5 pr-3">
        <Badge variant={entry.sync_type === 'full' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
          {entry.sync_type}
        </Badge>
      </td>
      <td className="py-1.5 pr-3 text-muted-foreground">
        {time.toLocaleDateString()} {time.toLocaleTimeString()}
      </td>
      <td className="py-1.5 pr-3 font-mono">{dur}</td>
      <td className="py-1.5">
        {entry.success
          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          : <XCircle className="h-3.5 w-3.5 text-red-500" />}
      </td>
    </tr>
  );
}

function coverageStatus(pct: number): 'good' | 'warning' | 'critical' {
  if (pct >= 99) return 'good';
  if (pct >= 95) return 'warning';
  return 'critical';
}

export function IntegrityDashboard({ adminAddress }: { adminAddress: string }) {
  const [data, setData] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/integrity?address=${encodeURIComponent(adminAddress)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [adminAddress]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-red-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="h-5 w-5" />
            <p>Failed to load integrity data: {error}</p>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const vpc = data.vote_power;
  const ai = data.ai_summaries;
  const hv = data.hash_verification;
  const cs = data.canonical_summaries;
  const stats = data.system_stats;
  const proposalAiPct = ai.proposals_with_abstract > 0
    ? Math.round(ai.proposals_with_summary / ai.proposals_with_abstract * 100) : 100;
  const rationaleAiPct = ai.rationales_with_text > 0
    ? Math.round(ai.rationales_with_summary / ai.rationales_with_text * 100) : 100;
  const canonicalPct = cs.total_proposals > 0
    ? Math.round(cs.with_canonical_summary / cs.total_proposals * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Alerts Banner */}
      {data.alerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-500">
                {data.alerts.length} alert{data.alerts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1">
              {data.alerts.map((a, i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <Badge variant={a.level === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {a.level}
                  </Badge>
                  <span className="text-foreground">{a.metric}: <strong>{a.value}</strong></span>
                  <span className="text-muted-foreground">(threshold: {a.threshold})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Data Integrity</h2>
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Data Coverage Metrics */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Database className="h-4 w-4" /> Data Coverage
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="Vote Power" value={`${vpc.coverage_pct}%`}
            subtitle={`${vpc.with_power.toLocaleString()} / ${vpc.total_votes.toLocaleString()}`}
            icon={Zap} status={coverageStatus(parseFloat(vpc.coverage_pct))}
          />
          <MetricCard
            title="Canonical Summaries" value={`${canonicalPct}%`}
            subtitle={`${cs.with_canonical_summary} / ${cs.total_proposals}`}
            icon={CheckCircle2} status={coverageStatus(canonicalPct)}
          />
          <MetricCard
            title="AI Proposals" value={`${proposalAiPct}%`}
            subtitle={`${ai.proposals_with_summary} / ${ai.proposals_with_abstract}`}
            icon={TrendingUp} status={coverageStatus(proposalAiPct)}
          />
          <MetricCard
            title="AI Rationales" value={`${rationaleAiPct}%`}
            subtitle={`${ai.rationales_with_summary} / ${ai.rationales_with_text}`}
            icon={TrendingUp} status={coverageStatus(rationaleAiPct)}
          />
        </div>
      </div>

      {/* Power Source Breakdown */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Zap className="h-4 w-4" /> Power Source
        </h3>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span>Exact: <strong>{vpc.exact_count.toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Nearest: <strong>{vpc.nearest_count.toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>NULL: <strong>{vpc.null_power}</strong></span>
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${vpc.total_votes ? vpc.exact_count / vpc.total_votes * 100 : 0}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${vpc.total_votes ? vpc.nearest_count / vpc.total_votes * 100 : 0}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${vpc.total_votes ? vpc.null_power / vpc.total_votes * 100 : 0}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hash Integrity */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Shield className="h-4 w-4" /> Hash Integrity
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="Verified" value={hv.rationale_verified} icon={CheckCircle2} status="good" />
          <MetricCard
            title="Mismatch" value={hv.rationale_mismatch}
            subtitle={`${hv.mismatch_rate_pct}% rate`}
            icon={AlertTriangle} status={hv.rationale_mismatch > 0 ? 'warning' : 'good'}
          />
          <MetricCard title="Pending" value={hv.rationale_pending} icon={Clock} />
          <MetricCard title="Unreachable" value={hv.rationale_unreachable} icon={XCircle}
            status={hv.rationale_unreachable > 100 ? 'warning' : undefined}
          />
        </div>
      </div>

      {/* Sync Health */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Activity className="h-4 w-4" /> Sync Health
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {(['fast', 'full'] as const).map(type => {
            const s = data.sync_health[type];
            if (!s) return (
              <Card key={type}>
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground">{type} sync</p>
                  <p className="text-sm text-muted-foreground mt-1">No data yet</p>
                </CardContent>
              </Card>
            );
            const staleOk = type === 'fast' ? (s.stale_minutes ?? 999) <= 90 : (s.stale_minutes ?? 999) <= 1560;
            return (
              <Card key={type}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground capitalize">{type} sync</p>
                    <Badge variant={staleOk ? 'secondary' : 'destructive'} className="text-[10px]">
                      {s.stale_minutes != null ? `${s.stale_minutes}m ago` : 'never'}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    {s.last_success
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    <span className="font-mono">{s.last_duration_ms ? `${(s.last_duration_ms / 1000).toFixed(1)}s` : '—'}</span>
                    <span className="text-muted-foreground">
                      {s.success_count} ok / {s.failure_count} fail
                    </span>
                  </div>
                  {s.last_error && (
                    <p className="text-[10px] text-red-400 mt-1 truncate">{s.last_error}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Sync History Table */}
        {data.sync_history.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Recent Sync Runs</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border">
                    <th className="text-left pb-1">Type</th>
                    <th className="text-left pb-1">Time</th>
                    <th className="text-left pb-1">Duration</th>
                    <th className="text-left pb-1">OK</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sync_history.slice(0, 10).map(entry => (
                    <SyncRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* System Stats */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Database className="h-4 w-4" /> System Scale
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <MetricCard title="DReps" value={stats.total_dreps.toLocaleString()} icon={Database} />
          <MetricCard title="Votes" value={stats.total_votes.toLocaleString()} icon={Activity} />
          <MetricCard title="Proposals" value={stats.total_proposals} icon={TrendingUp} />
          <MetricCard title="Rationales" value={stats.total_rationales.toLocaleString()} icon={Shield} />
          <MetricCard title="Snapshots" value={stats.total_power_snapshots.toLocaleString()} icon={Clock} />
          <MetricCard title="DReps w/ Snaps" value={stats.dreps_with_snapshots} icon={Zap} />
        </div>
      </div>
    </div>
  );
}
