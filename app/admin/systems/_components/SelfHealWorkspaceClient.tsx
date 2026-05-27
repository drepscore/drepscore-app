'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SelfHealActionRecord, SelfHealClassStats } from '@/lib/admin/systems';
import { fetchSystemsSection, formatDateTime } from './systems-client';
import { EmptyState, SectionCard, StatusBadge, WorkspaceHero } from './systems-ui';

function classStatStatus(stat: SelfHealClassStats) {
  if (stat.last24h === 0 && stat.last7d === 0) return 'warning';
  if (stat.successRate < 0.5) return 'critical';
  if (stat.successRate < 0.8) return 'warning';
  return 'good';
}

function actionStatus(action: SelfHealActionRecord) {
  if (action.escalated && action.success !== true) return 'critical';
  if (action.success === false) return 'warning';
  return 'good';
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatSignal(signal: Record<string, unknown>) {
  const entries = Object.entries(signal);
  if (entries.length === 0) return '—';
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

export function SelfHealWorkspaceClient() {
  const query = useQuery({
    queryKey: ['systems', 'self-heal'],
    queryFn: () => fetchSystemsSection('self-heal'),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-2xl border border-border/60 bg-muted/25" />
        <div className="h-96 animate-pulse rounded-2xl border border-border/60 bg-muted/25" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Self-heal history unavailable"
        description={
          query.error instanceof Error
            ? query.error.message
            : 'The self-heal action history could not be loaded.'
        }
      />
    );
  }

  const { summary, recentActions, classStats, registeredClasses } = query.data;

  return (
    <div className="space-y-6">
      <WorkspaceHero summary={summary}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classStats.map((stat) => (
            <div key={stat.class} className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold capitalize">{stat.class.replace(/_/g, ' ')}</p>
                <StatusBadge status={classStatStatus(stat)} />
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                {stat.last24h} in 24h • {stat.last7d} in 7d
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Success {formatPercent(stat.successRate)} • Last{' '}
                {stat.lastFiredAt ? formatDateTime(stat.lastFiredAt) : '—'}
              </p>
            </div>
          ))}
          {registeredClasses.length > classStats.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 p-4 text-sm text-slate-300">
              {registeredClasses.length} classes registered • {classStats.length} with stats
            </div>
          ) : null}
        </div>
      </WorkspaceHero>

      <SectionCard
        title="Recent actions"
        description="Most recent self-heal class fires across all registered classes. Last 100 rows."
      >
        {recentActions.length === 0 ? (
          <EmptyState
            title="No self-heal actions recorded yet"
            description="The walker has not fired any mitigation. This is normal in steady-state — actions appear when a class signal trips."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDateTime(action.startedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {action.class.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{action.action}</TableCell>
                  <TableCell className="max-w-[24rem] whitespace-normal text-xs text-muted-foreground">
                    {formatSignal(action.signal)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={actionStatus(action)} />
                    {action.escalated ? (
                      <Badge variant="destructive" className="ml-2 text-[10px]">
                        escalated
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
