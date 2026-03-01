'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wallet,
  Vote,
  CheckCircle2,
  XCircle,
  History,
  ArrowRight,
} from 'lucide-react';
import {
  DelegationHealthCard,
  RepresentationScoreCard,
  ActiveProposalsSection,
  RedelegationNudge,
  VoteBadge,
  type DashboardData,
} from '@/components/governance-cards';

export function GovernanceDashboard() {
  const { connected, isAuthenticated, reconnecting, delegatedDrepId, address } = useWallet();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reconnecting) return;
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
  }, [isAuthenticated, delegatedDrepId, reconnecting]);

  if (reconnecting || (loading && isAuthenticated)) return <DashboardSkeleton />;

  if (!isAuthenticated) {
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

      <div className="grid gap-6 md:grid-cols-2">
        <DelegationHealthCard health={data.delegationHealth} />
        <RepresentationScoreCard rep={data.representationScore} />
      </div>

      {data.redelegationSuggestions.length > 0 && data.representationScore.score !== null && data.representationScore.score < 50 && (
        <RedelegationNudge
          repScore={data.representationScore.score}
          misaligned={data.representationScore.misaligned}
          total={data.representationScore.total}
          suggestions={data.redelegationSuggestions}
        />
      )}

      <ActiveProposalsSection proposals={data.activeProposals} />

      <PollHistorySection history={data.pollHistory} />
    </div>
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
            <Button variant="outline" size="sm" className="gap-2 hover:text-primary hover:bg-primary/10">
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
