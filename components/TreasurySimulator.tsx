'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sliders, Share2, TrendingDown, Undo2, History } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { posthog } from '@/lib/posthog';
import { formatAda } from '@/lib/treasury';

interface SimulationData {
  currentBalance: number;
  currentEpoch: number;
  burnRatePerEpoch: number;
  avgIncomePerEpoch: number;
  pendingTotalAda: number;
  scenarios: Array<{
    name: string;
    key: string;
    projectedMonths: number;
    depletionEpoch: number | null;
    balanceCurve: Array<{ epoch: number; balanceAda: number }>;
  }>;
  counterfactual: {
    totalWithdrawnAda: number;
    largestWithdrawals: Array<{ title: string; amountAda: number; epoch: number }>;
    hypotheticalBalanceAda: number;
    additionalRunwayMonths: number;
  };
}

interface Props {
  currentBalance: number;
  burnRate: number;
  currentEpoch: number;
}

const SCENARIO_COLORS: Record<string, string> = {
  conservative: 'hsl(var(--primary))',
  moderate: 'hsl(45, 93%, 47%)',
  aggressive: 'hsl(0, 84%, 60%)',
  freeze: 'hsl(142, 71%, 45%)',
};

export function TreasurySimulator({ currentBalance, burnRate, currentEpoch }: Props) {
  const [data, setData] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [burnAdjust, setBurnAdjust] = useState(1);

  const fetchSimulation = useCallback((adjust: number) => {
    setLoading(true);
    fetch(`/api/treasury/simulate?burnAdjust=${adjust}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSimulation(1);
  }, [fetchSimulation]);

  const handleBurnChange = (value: number) => {
    setBurnAdjust(value);
    fetchSimulation(value);
    posthog.capture('treasury_simulator_used', { burnAdjust: value });
  };

  const handleShare = () => {
    const text = data?.scenarios
      ? `Cardano Treasury Scenarios:\n${data.scenarios.map(s => `• ${s.name}: ${s.projectedMonths >= 999 ? '∞' : s.projectedMonths + ' months'}`).join('\n')}\n\nExplore at ${window.location.href}`
      : '';
    navigator.clipboard.writeText(text);
    posthog.capture('treasury_scenario_shared');
  };

  if (loading && !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Scenario Controls
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleBurnChange(1)}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5 mr-1" /> Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Spending rate adjustment</span>
              <span className="font-mono tabular-nums">{Math.round(burnAdjust * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={burnAdjust}
              onChange={e => handleBurnChange(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Freeze</span>
              <span>Current</span>
              <span>3x</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Current', value: 1 },
              { label: '+25%', value: 1.25 },
              { label: '+50%', value: 1.5 },
              { label: '2x', value: 2 },
              { label: 'Freeze', value: 0 },
            ].map(preset => (
              <Button
                key={preset.label}
                variant={burnAdjust === preset.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleBurnChange(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Projection Chart */}
      {data?.scenarios && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Runway Projections</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="epoch"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis tickFormatter={(v) => formatAda(v)} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  formatter={(value: number, name: string) => [`${formatAda(value)} ADA`, name]}
                  labelFormatter={(l) => `Epoch ${l}`}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
                {data.scenarios.map(s => (
                  <Line
                    key={s.key}
                    data={s.balanceCurve}
                    dataKey="balanceAda"
                    name={s.name}
                    stroke={SCENARIO_COLORS[s.key] || 'hsl(var(--muted-foreground))'}
                    strokeWidth={s.key === 'conservative' ? 2.5 : 1.5}
                    dot={false}
                    strokeDasharray={s.key === 'freeze' ? '5 5' : undefined}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {data.scenarios.map(s => (
                <div key={s.key} className="text-center p-3 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground">{s.name}</div>
                  <div className="text-lg font-bold tabular-nums">
                    {s.projectedMonths >= 999 ? '∞' : `${s.projectedMonths}mo`}
                  </div>
                  {s.depletionEpoch && (
                    <div className="text-[10px] text-muted-foreground">
                      Depletion: Epoch {s.depletionEpoch}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Counterfactual Analysis */}
      {data?.counterfactual && data.counterfactual.totalWithdrawnAda > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Counterfactual Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              What if the largest treasury withdrawals had been rejected?
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Total Withdrawn</div>
                <div className="text-lg font-bold">{formatAda(data.counterfactual.totalWithdrawnAda)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Hypothetical Balance</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatAda(data.counterfactual.hypotheticalBalanceAda)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Additional Runway</div>
                <div className="text-lg font-bold">+{data.counterfactual.additionalRunwayMonths}mo</div>
              </div>
            </div>

            {data.counterfactual.largestWithdrawals.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Largest Withdrawals</div>
                {data.counterfactual.largestWithdrawals.map((w, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                    <span className="truncate flex-1">{w.title}</span>
                    <span className="font-mono tabular-nums ml-4">{formatAda(w.amountAda)} ADA</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
