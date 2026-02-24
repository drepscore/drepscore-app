'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreRing } from '@/components/ScoreRing';
import {
  Shield,
  Wallet,
  Vote,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  History,
  Users,
  Repeat,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

interface DashboardData {
  delegationHealth: {
    drepId: string;
    drepName: string | null;
    drepScore: number;
    participationRate: number;
    votedOnOpen: number;
    openProposalCount: number;
    alignmentScore: number | null;
  } | null;
  representationScore: {
    score: number | null;
    aligned: number;
    misaligned: number;
    total: number;
    comparisons: {
      proposalTxHash: string;
      proposalIndex: number;
      proposalTitle: string | null;
      userVote: string;
      drepVote: string;
      aligned: boolean;
    }[];
  };
  activeProposals: {
    txHash: string;
    proposalIndex: number;
    title: string | null;
    proposalType: string;
    priority: string;
    epochsRemaining: number | null;
    userVote: string | null;
    drepVote: string | null;
  }[];
  pollHistory: {
    proposalTxHash: string;
    proposalIndex: number;
    proposalTitle: string | null;
    userVote: string;
    communityConsensus: string | null;
    drepVote: string | null;
    alignedWithDrep: boolean | null;
    votedAt: string;
  }[];
  redelegationSuggestions: {
    drepId: string;
    drepName: string | null;
    drepScore: number;
    matchCount: number;
    totalComparisons: number;
    matchRate: number;
  }[];
  currentEpoch: number;
}

const VOTE_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  Yes: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  No: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  Abstain: { icon: MinusCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  important: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  standard: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function GovernanceDashboard() {
  const { connected, isAuthenticated, delegatedDrepId, address } = useWallet();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const token = getStoredSession();
    if (!token) { setLoading(false); return; }

    const params = new URLSearchParams();
    if (delegatedDrepId) params.set('drepId', delegatedDrepId);

    fetch(`/api/governance/holder?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load your governance dashboard.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, delegatedDrepId]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Connect and sign in with your Cardano wallet to see your personal governance dashboard.
        </p>
        <Button
          onClick={() => window.dispatchEvent(new Event('openWalletConnect'))}
          className="gap-2"
        >
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Sign In Required</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Your wallet is connected but not signed in. Please sign a message to verify ownership.
        </p>
      </div>
    );
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <p className="text-destructive text-center py-12">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Governance</h1>
        <p className="text-sm text-muted-foreground">
          Track your delegation, voice your opinion, and see how well you&apos;re represented.
        </p>
      </div>

      {/* Top row: Delegation Health + Representation Score */}
      <div className="grid gap-6 md:grid-cols-2">
        <DelegationHealthCard health={data.delegationHealth} />
        <RepresentationScoreCard rep={data.representationScore} />
      </div>

      {/* Re-delegation Nudge (conditional) */}
      {data.redelegationSuggestions.length > 0 && data.representationScore.score !== null && data.representationScore.score < 50 && (
        <RedelegationNudge
          repScore={data.representationScore.score}
          misaligned={data.representationScore.misaligned}
          total={data.representationScore.total}
          suggestions={data.redelegationSuggestions}
        />
      )}

      {/* Active Proposals */}
      <ActiveProposalsSection proposals={data.activeProposals} />

      {/* Poll History */}
      <PollHistorySection history={data.pollHistory} />
    </div>
  );
}

// --- Section Components ---

function DelegationHealthCard({ health }: { health: DashboardData['delegationHealth'] }) {
  if (!health) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Delegation Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t delegated to a DRep yet. Find one aligned with your values to participate in governance.
          </p>
          <Link href="/">
            <Button size="sm" className="gap-2">
              Find a DRep
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const votePct = health.openProposalCount > 0
    ? Math.round((health.votedOnOpen / health.openProposalCount) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Your DRep
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/drep/${encodeURIComponent(health.drepId)}`}
              className="text-lg font-semibold hover:text-primary transition-colors"
            >
              {health.drepName || health.drepId.slice(0, 16) + '...'}
            </Link>
            <p className="text-xs text-muted-foreground">Score: {health.drepScore}/100</p>
          </div>
          <Link href={`/drep/${encodeURIComponent(health.drepId)}`}>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              Profile <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Accountability bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Voted on open proposals</span>
            <span className="font-medium tabular-nums">{health.votedOnOpen}/{health.openProposalCount}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                votePct >= 80 ? 'bg-green-500' : votePct >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${votePct}%` }}
            />
          </div>
        </div>

        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Participation</span>
            <p className="font-semibold tabular-nums">{health.participationRate}%</p>
          </div>
          {health.alignmentScore !== null && (
            <div>
              <span className="text-muted-foreground">Value Alignment</span>
              <p className="font-semibold tabular-nums">{health.alignmentScore}%</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RepresentationScoreCard({ rep }: { rep: DashboardData['representationScore'] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleComparisons = showAll ? rep.comparisons : rep.comparisons.slice(0, 5);

  if (rep.score === null || rep.total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Representation Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vote on proposals to see how well your DRep represents your views.
            Each poll vote you cast builds this score.
          </p>
          <Link href="/proposals">
            <Button variant="outline" size="sm" className="gap-2">
              <Vote className="h-3.5 w-3.5" />
              Vote on Proposals
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Representation Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-6">
          <ScoreRing score={rep.score} size={100} strokeWidth={8} />
          <div className="space-y-1">
            <p className="text-sm">
              Your DRep voted with you <strong>{rep.aligned}</strong> of <strong>{rep.total}</strong> times.
            </p>
            <p className="text-xs text-muted-foreground">
              Based on proposals where you both weighed in.
            </p>
          </div>
        </div>

        {/* Comparison table */}
        {visibleComparisons.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vote Comparison
            </p>
            {visibleComparisons.map((c) => (
              <Link
                key={`${c.proposalTxHash}-${c.proposalIndex}`}
                href={`/proposals/${c.proposalTxHash}/${c.proposalIndex}`}
                className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
              >
                {c.aligned ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className="truncate flex-1">
                  {c.proposalTitle || `${c.proposalTxHash.slice(0, 12)}...`}
                </span>
                <VoteBadge vote={c.userVote} label="You" />
                <VoteBadge vote={c.drepVote} label="DRep" />
              </Link>
            ))}
            {rep.comparisons.length > 5 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-primary hover:underline"
              >
                {showAll ? 'Show less' : `Show all ${rep.comparisons.length} comparisons`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveProposalsSection({ proposals }: { proposals: DashboardData['activeProposals'] }) {
  const needsVoteCount = useMemo(
    () => proposals.filter(p => !p.userVote).length,
    [proposals]
  );

  if (proposals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Vote className="h-4 w-4 text-primary" />
            Active Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No open proposals right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Vote className="h-4 w-4 text-primary" />
            Active Proposals
          </CardTitle>
          {needsVoteCount > 0 && (
            <Badge variant="outline" className="text-xs gap-1 bg-primary/10 text-primary border-primary/30">
              {needsVoteCount} need your vote
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {proposals.map((p) => (
            <Link
              key={`${p.txHash}-${p.proposalIndex}`}
              href={`/proposals/${p.txHash}/${p.proposalIndex}`}
              className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded px-2 py-2 -mx-2 transition-colors"
            >
              {/* Vote status indicator */}
              {p.userVote ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}

              <span className="truncate flex-1">
                {p.title || `Proposal ${p.txHash.slice(0, 12)}...`}
              </span>

              {/* Priority */}
              <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_STYLES[p.priority] || ''}`}>
                {p.priority}
              </Badge>

              {/* Deadline */}
              {p.epochsRemaining !== null && p.epochsRemaining <= 2 && (
                <Badge variant="outline" className="text-[10px] shrink-0 gap-0.5 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800">
                  <Clock className="h-2.5 w-2.5" />
                  {p.epochsRemaining}e
                </Badge>
              )}

              {/* Your vote + DRep vote */}
              {p.userVote && <VoteBadge vote={p.userVote} label="You" />}
              {p.drepVote && <VoteBadge vote={p.drepVote} label="DRep" />}

              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t">
          <Link href="/proposals">
            <Button variant="outline" size="sm" className="w-full gap-1">
              View All Proposals
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PollHistorySection({ history }: { history: DashboardData['pollHistory'] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? history : history.slice(0, 8);

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const withDrep = history.filter(h => h.alignedWithDrep !== null);
    const alignedWithDrep = withDrep.filter(h => h.alignedWithDrep).length;
    const withConsensus = history.filter(h => h.communityConsensus);
    const matchedCommunity = withConsensus.filter(h => h.userVote === h.communityConsensus).length;

    return {
      total: history.length,
      alignedWithDrep,
      drepComparisons: withDrep.length,
      matchedCommunity,
      communityComparisons: withConsensus.length,
    };
  }, [history]);

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Your Voice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You haven&apos;t voted in any polls yet. Head to the proposals page to share your opinion.
          </p>
          <Link href="/proposals" className="mt-3 inline-block">
            <Button variant="outline" size="sm" className="gap-2">
              <Vote className="h-3.5 w-3.5" />
              Browse Proposals
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Your Voice
          <Badge variant="secondary" className="text-xs">{stats?.total} votes</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick stats */}
        {stats && (
          <div className="flex gap-6 text-xs">
            {stats.drepComparisons > 0 && (
              <div>
                <span className="text-muted-foreground">DRep agreed</span>
                <p className="font-semibold tabular-nums">
                  {stats.alignedWithDrep}/{stats.drepComparisons}
                </p>
              </div>
            )}
            {stats.communityComparisons > 0 && (
              <div>
                <span className="text-muted-foreground">With community</span>
                <p className="font-semibold tabular-nums">
                  {stats.matchedCommunity}/{stats.communityComparisons}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Vote history list */}
        <div className="space-y-1">
          {visible.map((h) => (
            <Link
              key={`${h.proposalTxHash}-${h.proposalIndex}`}
              href={`/proposals/${h.proposalTxHash}/${h.proposalIndex}`}
              className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
            >
              <VoteBadge vote={h.userVote} />
              <span className="truncate flex-1">
                {h.proposalTitle || `${h.proposalTxHash.slice(0, 12)}...`}
              </span>
              {h.alignedWithDrep !== null && (
                h.alignedWithDrep ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400">DRep agreed</span>
                ) : (
                  <span className="text-[10px] text-red-600 dark:text-red-400">DRep differed</span>
                )
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {new Date(h.votedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </Link>
          ))}
        </div>

        {history.length > 8 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-primary hover:underline"
          >
            {showAll ? 'Show recent' : `Show all ${history.length} votes`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function RedelegationNudge({
  repScore,
  misaligned,
  total,
  suggestions,
}: {
  repScore: number;
  misaligned: number;
  total: number;
  suggestions: DashboardData['redelegationSuggestions'];
}) {
  return (
    <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <Repeat className="h-4 w-4" />
          Representation Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
          Your DRep voted differently from you on <strong>{misaligned}</strong> of{' '}
          <strong>{total}</strong> recent proposals ({repScore}% alignment).
          Consider exploring DReps who vote more like you.
        </p>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-800/70 dark:text-amber-300/70 uppercase tracking-wide">
              DReps who voted like you
            </p>
            {suggestions.map((s) => (
              <Link
                key={s.drepId}
                href={`/drep/${encodeURIComponent(s.drepId)}`}
                className="flex items-center gap-3 text-sm hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded px-2 py-1.5 -mx-2 transition-colors"
              >
                <Users className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span className="truncate flex-1 font-medium">
                  {s.drepName || `${s.drepId.slice(0, 16)}...`}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">Score: {s.drepScore}</span>
                <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800">
                  {s.matchRate}% match
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Utility Components ---

function VoteBadge({ vote, label }: { vote: string; label?: string }) {
  const config = VOTE_CONFIG[vote];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded shrink-0 ${config.bg} ${config.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {label ? `${label}: ${vote}` : vote}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 mt-2" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-36" />
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    </div>
  );
}
