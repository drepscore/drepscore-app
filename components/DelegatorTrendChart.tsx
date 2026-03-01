'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';

interface Snapshot {
  epoch: number;
  votingPowerAda: number;
  delegatorCount: number | null;
}

interface DelegatorTrendChartProps {
  drepId: string;
}

export function DelegatorTrendChart({ drepId }: DelegatorTrendChartProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [currentDelegators, setCurrentDelegators] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!drepId) return;
    fetch(`/api/dashboard/delegator-trends?drepId=${encodeURIComponent(drepId)}`)
      .then(r => r.json())
      .then(d => {
        setSnapshots(d.snapshots || []);
        setCurrentDelegators(d.currentDelegators);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [drepId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Delegator Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Delegator Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Power tracking data will appear here as snapshots are collected.
          </p>
          {currentDelegators !== null && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{currentDelegators}</span>
              <span className="text-sm text-muted-foreground">current delegators</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const chartData = snapshots.map(s => ({
    epoch: `E${s.epoch}`,
    'Voting Power (ADA)': s.votingPowerAda,
  }));

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const powerChange = last.votingPowerAda - first.votingPowerAda;
  const powerChangeFormatted = powerChange >= 1_000_000
    ? `${(powerChange / 1_000_000).toFixed(1)}M`
    : powerChange >= 1_000
      ? `${(powerChange / 1_000).toFixed(0)}K`
      : powerChange.toLocaleString();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Delegator Analytics
          </CardTitle>
          <div className="flex items-center gap-3">
            {currentDelegators !== null && (
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{currentDelegators}</span> delegators
              </span>
            )}
            {snapshots.length > 1 && (
              <span className={`text-xs font-medium flex items-center gap-1 ${powerChange > 0 ? 'text-green-600 dark:text-green-400' : powerChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {powerChange > 0 ? <TrendingUp className="h-3 w-3" /> : powerChange < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                {powerChange > 0 ? '+' : ''}{powerChangeFormatted} ADA
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="epoch" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v} />
              <RechartsTooltip
                contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                formatter={(value: number) => [`${value.toLocaleString()} ADA`, 'Voting Power']}
              />
              <Line type="monotone" dataKey="Voting Power (ADA)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
