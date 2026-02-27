'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Users } from 'lucide-react';
import type { ScoreSnapshot } from '@/lib/data';

interface PillarData {
  effectiveParticipation: number;
  rationaleRate: number;
  reliabilityScore: number;
  profileCompleteness: number;
  deliberationModifier: number;
}

interface AnalyticsDashboardProps {
  scoreHistory: ScoreSnapshot[];
  pillars: PillarData;
  votes: { vote: string; date: Date; proposalType: string | null }[];
  drepScore: number;
  percentile?: number;
}

const pillarConfig = {
  participation: { label: 'Participation', color: 'var(--chart-1)' },
  rationale: { label: 'Rationale', color: 'var(--chart-2)' },
  reliability: { label: 'Reliability', color: 'var(--chart-3)' },
  profile: { label: 'Profile', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const scoreHistoryConfig = {
  score: { label: 'Overall Score', color: 'var(--chart-1)' },
  participation: { label: 'Participation', color: 'var(--chart-2)' },
  rationale: { label: 'Rationale', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const voteActivityConfig = {
  yes: { label: 'Yes', color: 'hsl(142 71% 45%)' },
  no: { label: 'No', color: 'hsl(0 84% 60%)' },
  abstain: { label: 'Abstain', color: 'hsl(45 93% 47%)' },
} satisfies ChartConfig;

const proposalTypeConfig = {
  count: { label: 'Votes', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function AnalyticsDashboard({
  scoreHistory,
  pillars,
  votes,
  drepScore,
  percentile,
}: AnalyticsDashboardProps) {
  const radarData = useMemo(() => [
    { pillar: 'Participation', value: pillars.effectiveParticipation, fullMark: 100 },
    { pillar: 'Rationale', value: pillars.rationaleRate, fullMark: 100 },
    { pillar: 'Reliability', value: pillars.reliabilityScore, fullMark: 100 },
    { pillar: 'Profile', value: pillars.profileCompleteness, fullMark: 100 },
  ], [pillars]);

  const historyData = useMemo(() => {
    return scoreHistory.map(s => ({
      date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: s.score,
      participation: s.effectiveParticipation,
      rationale: s.rationaleRate,
    }));
  }, [scoreHistory]);

  const monthlyVotes = useMemo(() => {
    const grouped: Record<string, { month: string; dateObj: Date; yes: number; no: number; abstain: number }> = {};
    for (const v of votes) {
      const month = v.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!grouped[month]) {
        grouped[month] = { month, dateObj: new Date(v.date.getFullYear(), v.date.getMonth(), 1), yes: 0, no: 0, abstain: 0 };
      }
      const key = v.vote.toLowerCase() as 'yes' | 'no' | 'abstain';
      if (key in grouped[month]) grouped[month][key]++;
    }
    return Object.values(grouped).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [votes]);

  const proposalTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of votes) {
      const type = v.proposalType || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([type, count]) => ({ type: formatProposalType(type), count }))
      .sort((a, b) => b.count - a.count);
  }, [votes]);

  const scoreChange = scoreHistory.length >= 2
    ? scoreHistory[scoreHistory.length - 1].score - scoreHistory[scoreHistory.length - 2].score
    : null;

  const scoreTrend = scoreHistory.length >= 3
    ? scoreHistory[scoreHistory.length - 1].score - scoreHistory[0].score
    : null;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="DRep Score"
          value={drepScore}
          suffix="/100"
          change={scoreChange}
          icon={<Target className="h-4 w-4" />}
        />
        <KpiCard
          title="Percentile"
          value={percentile ?? null}
          suffix="%"
          description="Among active DReps"
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          title="Total Votes"
          value={votes.length}
          description={`${votes.filter(v => v.vote === 'Yes').length}Y / ${votes.filter(v => v.vote === 'No').length}N / ${votes.filter(v => v.vote === 'Abstain').length}A`}
          icon={<Activity className="h-4 w-4" />}
        />
        <KpiCard
          title="Score Trend"
          value={scoreTrend}
          suffix=" pts"
          description="Since tracking started"
          icon={<BarChart3 className="h-4 w-4" />}
          showTrend
        />
      </div>

      {/* Charts Row 1: Radar + Score History */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pillar Radar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pillar Breakdown</CardTitle>
            <CardDescription>Performance across scoring dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pillarConfig} className="mx-auto aspect-square max-h-[280px]">
              <RadarChart data={radarData}>
                <PolarGrid className="fill-muted/20 stroke-border" />
                <PolarAngleAxis
                  dataKey="pillar"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Radar
                  name="Score"
                  dataKey="value"
                  fill="var(--chart-1)"
                  fillOpacity={0.25}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Score History Line Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score History</CardTitle>
            <CardDescription>Overall score and pillar trends over time</CardDescription>
          </CardHeader>
          <CardContent>
            {historyData.length > 1 ? (
              <ChartContainer config={scoreHistoryConfig} className="h-[280px]">
                <LineChart data={historyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} className="stroke-border/50" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="score" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="participation" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="rationale" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                More snapshots needed to show trend data.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Vote Activity + Proposal Types */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stacked Vote Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Voting Activity</CardTitle>
            <CardDescription>Monthly vote distribution by outcome</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyVotes.length > 0 ? (
              <ChartContainer config={voteActivityConfig} className="h-[280px]">
                <AreaChart data={monthlyVotes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillYes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillNo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillAbstain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(45 93% 47%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(45 93% 47%)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} className="stroke-border/50" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area type="monotone" dataKey="yes" stackId="1" stroke="hsl(142 71% 45%)" fill="url(#fillYes)" strokeWidth={2} />
                  <Area type="monotone" dataKey="no" stackId="1" stroke="hsl(0 84% 60%)" fill="url(#fillNo)" strokeWidth={2} />
                  <Area type="monotone" dataKey="abstain" stackId="1" stroke="hsl(45 93% 47%)" fill="url(#fillAbstain)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No voting activity to display.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Proposal Type Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Votes by Proposal Type</CardTitle>
            <CardDescription>Distribution of governance participation</CardDescription>
          </CardHeader>
          <CardContent>
            {proposalTypeCounts.length > 0 ? (
              <ChartContainer config={proposalTypeConfig} className="h-[280px]">
                <BarChart data={proposalTypeCounts} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} className="stroke-border/50" />
                  <YAxis
                    dataKey="type"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    width={90}
                  />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No proposal data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  suffix = '',
  change,
  description,
  icon,
  showTrend,
}: {
  title: string;
  value: number | null;
  suffix?: string;
  change?: number | null;
  description?: string;
  icon: React.ReactNode;
  showTrend?: boolean;
}) {
  const displayValue = value !== null ? value : '—';
  const isPositive = (showTrend ? value : change) && (showTrend ? value! > 0 : change! > 0);
  const isNegative = (showTrend ? value : change) && (showTrend ? value! < 0 : change! < 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">{displayValue}</span>
          {value !== null && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {change !== undefined && change !== null && change !== 0 && !showTrend && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change > 0 ? '+' : ''}{change} from last snapshot
          </div>
        )}
        {showTrend && value !== null && value !== 0 && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {value > 0 ? '+' : ''}{value}{suffix}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatProposalType(type: string): string {
  const map: Record<string, string> = {
    TreasuryWithdrawals: 'Treasury',
    ParameterChange: 'Params',
    HardForkInitiation: 'Hard Fork',
    NoConfidence: 'No Confidence',
    NewCommittee: 'Committee',
    NewConstitutionalCommittee: 'Committee',
    NewConstitution: 'Constitution',
    UpdateConstitution: 'Constitution',
    InfoAction: 'Info',
  };
  return map[type] || type;
}

// Re-export Radar for use in the RadarChart
import { Radar } from 'recharts';
