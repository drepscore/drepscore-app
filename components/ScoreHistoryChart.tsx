'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceDot,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import type { ScoreSnapshot } from '@/lib/data';
import { getScoreAttribution, type DayAttribution } from '@/utils/attribution';

interface ScoreHistoryChartProps {
  history: ScoreSnapshot[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AttributionTooltipContent({ active, payload, label, attributionMap }: any) {
  if (!active || !payload?.length) return null;

  const scoreEntry = payload.find((p: any) => p.dataKey === 'Score');
  const rawDate = scoreEntry?.payload?.rawDate;
  const attribution: DayAttribution | undefined = rawDate ? attributionMap.get(rawDate) : undefined;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-md text-sm max-w-[280px]">
      <p className="font-medium text-card-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.dataKey}
          </span>
          <span className="font-mono tabular-nums">{entry.value}</span>
        </div>
      ))}
      {attribution && attribution.totalDelta !== 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className={`text-xs font-medium ${attribution.totalDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {attribution.totalDelta > 0 ? '+' : ''}{attribution.totalDelta} pts from previous
          </p>
          {attribution.pillars
            .filter(p => Math.abs(p.weightedDelta) >= 0.5)
            .sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta))
            .map(p => (
              <p key={p.key} className="text-xs text-muted-foreground">
                {p.label}: {p.weightedDelta > 0 ? '+' : ''}{p.weightedDelta.toFixed(1)} pts
                <span className="opacity-60"> ({p.prev}→{p.curr})</span>
              </p>
            ))
          }
        </div>
      )}
    </div>
  );
}

export function ScoreHistoryChart({ history }: ScoreHistoryChartProps) {
  const [showPillars, setShowPillars] = useState(false);

  const attributions = useMemo(() => getScoreAttribution(history), [history]);
  const attributionMap = useMemo(() => {
    const map = new Map<string, DayAttribution>();
    for (const a of attributions) map.set(a.date, a);
    return map;
  }, [attributions]);

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Score tracking started recently. Check back soon to see how this DRep&apos;s score changes over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = history.map(s => ({
    date: formatDate(s.date),
    rawDate: s.date,
    Score: s.score,
    Participation: s.effectiveParticipation,
    Rationale: s.rationaleRate,
    Reliability: s.reliabilityScore,
    Profile: s.profileCompleteness,
  }));

  const significantDays = chartData.filter(d => {
    const attr = attributionMap.get(d.rawDate);
    return attr?.isSignificant;
  });

  const latest = history[history.length - 1];
  const first = history[0];
  const scoreChange = latest.score - first.score;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Score History
          </CardTitle>
          <div className="flex items-center gap-3">
            {history.length > 1 && (
              <span className={`text-sm font-medium ${scoreChange > 0 ? 'text-green-600 dark:text-green-400' : scoreChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {scoreChange > 0 ? '+' : ''}{scoreChange} pts since tracking started
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPillars(!showPillars)}
              className="text-xs"
            >
              {showPillars ? 'Hide Pillars' : 'Show Pillars'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 1 ? (
          <div className="text-center py-6">
            <p className="text-3xl font-bold tabular-nums">{latest.score}</p>
            <p className="text-sm text-muted-foreground mt-1">
              First snapshot recorded {formatDate(latest.date)}. Trend data will appear as more snapshots are collected.
            </p>
          </div>
        ) : (
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <RechartsTooltip
                  content={<AttributionTooltipContent attributionMap={attributionMap} />}
                />
                <Line
                  type="monotone"
                  dataKey="Score"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {showPillars && (
                  <>
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="Participation" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="Rationale" stroke="hsl(var(--chart-3))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="Reliability" stroke="hsl(var(--chart-4))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="Profile" stroke="hsl(var(--chart-5))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  </>
                )}
                {significantDays.map(d => (
                  <ReferenceDot
                    key={d.rawDate}
                    x={d.date}
                    y={d.Score}
                    r={8}
                    fill={attributionMap.get(d.rawDate)!.totalDelta > 0 ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)'}
                    fillOpacity={0.3}
                    stroke="none"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
