'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { posthog } from '@/lib/posthog';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ReferenceLine,
} from 'recharts';
import { formatAda } from '@/lib/treasury';

interface HistoryData {
  snapshots: Array<{ epoch: number; balanceAda: number; withdrawalsAda: number; reservesIncomeAda: number }>;
  incomeVsOutflow: Array<{ epoch: number; incomeAda: number; outflowAda: number; netAda: number }>;
}

export function TreasuryCharts() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<30 | 90 | 500>(90);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/treasury/history?epochs=${range}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  if (loading) return <Skeleton className="h-80 w-full" />;
  if (!data || !data.snapshots.length) return null;

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex gap-2">
        {([30, 90, 500] as const).map(r => (
          <Button
            key={r}
            variant={range === r ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setRange(r); posthog.capture('treasury_chart_range_changed', { range: r }); }}
          >
            {r === 500 ? 'All Time' : `${r} Epochs`}
          </Button>
        ))}
      </div>

      {/* Treasury Balance Over Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Treasury Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.snapshots}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="epoch" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={(v) => formatAda(v)} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                formatter={(value: number) => [`${formatAda(value)} ADA`, 'Balance']}
                labelFormatter={(l) => `Epoch ${l}`}
                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="balanceAda" stroke="hsl(var(--primary))" fill="url(#balanceGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Income vs Outflow */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Income vs Outflow Per Epoch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.incomeVsOutflow}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="epoch" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={(v) => formatAda(v)} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${formatAda(Math.abs(value))} ADA`,
                  name === 'incomeAda' ? 'Income' : name === 'outflowAda' ? 'Outflow' : 'Net',
                ]}
                labelFormatter={(l) => `Epoch ${l}`}
                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend formatter={(v) => v === 'incomeAda' ? 'Income (reserves + fees)' : v === 'outflowAda' ? 'Outflow (withdrawals)' : 'Net'} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="incomeAda" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="outflowAda" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
