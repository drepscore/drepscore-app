'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import type { ScoreSnapshot } from '@/lib/data';

interface ScoreHistoryChartProps {
  history: ScoreSnapshot[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ScoreHistoryChart({ history }: ScoreHistoryChartProps) {
  const [showPillars, setShowPillars] = useState(false);

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
    Consistency: s.consistencyScore,
    Profile: s.profileCompleteness,
  }));

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
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
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
                    <Line type="monotone" dataKey="Consistency" stroke="hsl(var(--chart-4))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="Profile" stroke="hsl(var(--chart-5))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
