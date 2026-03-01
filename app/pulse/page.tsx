'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShareActions } from '@/components/ShareActions';
import { TreasuryHealthWidget } from '@/components/TreasuryHealthWidget';
import {
  Landmark,
  ScrollText,
  Users,
  Vote,
  TrendingUp,
  TrendingDown,
  Trophy,
  Crown,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { posthog } from '@/lib/posthog';

export const dynamic = 'force-dynamic';

// -- Animated counter (extracted from GovernancePulseHero pattern) --

function AnimatedCounter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const numericPart = value.replace(/[^0-9.]/g, '');
    const target = parseFloat(numericPart);
    if (isNaN(target)) { el.textContent = value + suffix; return; }
    const textSuffix = value.replace(/[0-9.,]/g, '') + suffix;
    const duration = 1200;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      el!.textContent = (target >= 10 ? Math.round(current) : current.toFixed(1)) + textSuffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value, suffix]);
  return <span ref={ref}>{value}{suffix}</span>;
}

// -- Types --

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  avgParticipationRate: number;
  avgRationaleRate: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  communityGap: {
    txHash: string;
    index: number;
    title: string;
    pollYes: number;
    pollNo: number;
    pollTotal: number;
    drepVotePct: number;
  }[];
}

interface LeaderboardEntry {
  rank: number;
  drepId: string;
  name: string;
  score: number;
  sizeTier: string;
  participation: number;
  rationale: number;
}

interface Mover {
  drepId: string;
  name: string;
  currentScore: number;
  previousScore: number;
  delta: number;
}

interface HallEntry {
  drepId: string;
  name: string;
  score: number;
  days: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  weeklyMovers: { gainers: Mover[]; losers: Mover[] };
  hallOfFame: HallEntry[];
}

// -- Helpers --

function tierColorClass(score: number) {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

const SIZE_COLORS: Record<string, string> = {
  Small: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Large: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Whale: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// -- Page component --

export default function PulsePage() {
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [lb, setLb] = useState<LeaderboardData | null>(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    posthog.capture('pulse_page_viewed');
    Promise.all([
      fetch('/api/governance/pulse').then(r => r.json()),
      fetch('/api/governance/leaderboard').then(r => r.json()),
    ]).then(([p, l]) => {
      setPulse(p);
      setLb(l);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tierFilter === 'all') return;
    posthog.capture('pulse_tier_filter_changed', { tier: tierFilter });
    fetch(`/api/governance/leaderboard?tier=${tierFilter}`)
      .then(r => r.json())
      .then(d => setLb(prev => prev ? { ...prev, leaderboard: d.leaderboard } : d))
      .catch(() => {});
  }, [tierFilter]);

  if (loading) return <PulseSkeleton />;

  return (
    <div className="container mx-auto px-4 py-8 space-y-10 max-w-6xl">
      {/* Page header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Governance Pulse</h1>
        <p className="text-muted-foreground">
          Real-time health of Cardano&apos;s on-chain governance
        </p>
      </div>

      {/* Treasury Health */}
      <TreasuryHealthWidget />

      {/* Hero stats */}
      {pulse && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Landmark className="h-5 w-5 text-green-500" />} label="ADA Governed" value={pulse.totalAdaGoverned} />
          <StatCard icon={<ScrollText className="h-5 w-5 text-amber-500" />} label="Active Proposals" value={String(pulse.activeProposals)} />
          <StatCard icon={<Users className="h-5 w-5 text-blue-500" />} label="Active DReps" value={String(pulse.activeDReps)} />
          <StatCard icon={<Vote className="h-5 w-5 text-indigo-500" />} label="Votes This Week" value={String(pulse.votesThisWeek)} />
        </div>
      )}

      {/* Participation & rationale rates */}
      {pulse && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{pulse.avgParticipationRate}%</p>
                <p className="text-sm text-muted-foreground">Avg DRep Participation Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10">
                <ScrollText className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{pulse.avgRationaleRate}%</p>
                <p className="text-sm text-muted-foreground">Avg DRep Rationale Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Community vs DRep Gap */}
      {pulse && pulse.communityGap.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Community Sentiment
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How delegators polled vs how proposals are trending
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pulse.communityGap.map(g => {
                const yesPct = g.pollTotal > 0 ? Math.round((g.pollYes / g.pollTotal) * 100) : 0;
                const noPct = g.pollTotal > 0 ? Math.round((g.pollNo / g.pollTotal) * 100) : 0;
                return (
                  <Link key={`${g.txHash}:${g.index}`} href={`/proposals/${g.txHash}/${g.index}`} className="block">
                    <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {g.pollTotal} community votes · {g.drepVotePct}% DReps voted
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">{yesPct}%</span>
                          <p className="text-[10px] text-muted-foreground">Yes</p>
                        </div>
                        <div className="w-24 h-3 bg-muted rounded-full overflow-hidden flex">
                          <div className="bg-green-500 h-full" style={{ width: `${yesPct}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${noPct}%` }} />
                        </div>
                        <div className="text-center">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">{noPct}%</span>
                          <p className="text-[10px] text-muted-foreground">No</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {lb && (
        <section id="leaderboard">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  DRep Leaderboard
                </CardTitle>
                <div className="flex gap-1.5">
                  {['all', 'Small', 'Medium', 'Large', 'Whale'].map(t => (
                    <Button
                      key={t}
                      variant={tierFilter === t ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => setTierFilter(t)}
                    >
                      {t === 'all' ? 'All' : t}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lb.leaderboard.map(d => (
                  <Link key={d.drepId} href={`/drep/${encodeURIComponent(d.drepId)}`} className="block">
                    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <span className={`text-lg font-bold tabular-nums w-8 ${d.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        #{d.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[10px] ${SIZE_COLORS[d.sizeTier] || ''}`}>
                            {d.sizeTier}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            P:{d.participation}% R:{d.rationale}%
                          </span>
                        </div>
                      </div>
                      <span className={`text-xl font-bold tabular-nums ${tierColorClass(d.score)}`}>{d.score}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Weekly Movers */}
      {lb && (lb.weeklyMovers.gainers.length > 0 || lb.weeklyMovers.losers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lb.weeklyMovers.gainers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Biggest Gainers This Week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lb.weeklyMovers.gainers.map(m => (
                  <Link key={m.drepId} href={`/drep/${encodeURIComponent(m.drepId)}`} className="block">
                    <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                      <span className="text-sm truncate flex-1">{m.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{m.currentScore}</span>
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30">
                          +{m.delta}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {lb.weeklyMovers.losers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Biggest Drops This Week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lb.weeklyMovers.losers.map(m => (
                  <Link key={m.drepId} href={`/drep/${encodeURIComponent(m.drepId)}`} className="block">
                    <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                      <span className="text-sm truncate flex-1">{m.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{m.currentScore}</span>
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">
                          {m.delta}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Hall of Fame */}
      {lb && lb.hallOfFame.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Hall of Fame
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              DReps maintaining a Strong score (80+) for 90+ days
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lb.hallOfFame.map(d => (
                <Link key={d.drepId} href={`/drep/${encodeURIComponent(d.drepId)}`} className="block">
                  <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-center">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400 mt-1">{d.score}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{d.days}+ days at Strong</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Share section */}
      <div className="flex items-center justify-center gap-4 py-4">
        <ShareActions
          url="https://drepscore.io/pulse"
          text="Check the health of Cardano governance in real-time on @drepscore:"
          imageUrl="/api/og/pulse"
          imageFilename="governance-pulse.png"
          surface="pulse_page"
          variant="buttons"
        />
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 py-6">
        <p className="text-lg font-semibold">Find the right DRep for you</p>
        <Link href="/discover" onClick={() => posthog.capture('pulse_discover_cta_clicked')}>
          <Button size="lg" className="gap-2">
            Discover DReps <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col items-center text-center gap-2">
        {icon}
        <span className="text-2xl font-bold tabular-nums">
          <AnimatedCounter value={value} />
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

function PulseSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
      <div className="text-center space-y-2">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-96" />
    </div>
  );
}
