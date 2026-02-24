'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Scroll,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react';

interface GovernanceSummary {
  openCount: number;
  criticalOpenCount: number;
  importantOpenCount: number;
  currentEpoch: number;
  drepVotedCount?: number;
  drepMissingCount?: number;
  recentVotes?: { title: string; vote: string; txHash: string; index: number }[];
}

const VOTE_ICONS: Record<string, typeof CheckCircle2> = {
  Yes: CheckCircle2,
  No: XCircle,
  Abstain: MinusCircle,
};

const VOTE_COLORS: Record<string, string> = {
  Yes: 'text-green-600 dark:text-green-400',
  No: 'text-red-600 dark:text-red-400',
  Abstain: 'text-amber-600 dark:text-amber-400',
};

export function GovernanceWidget() {
  const { delegatedDrepId } = useWallet();
  const [data, setData] = useState<GovernanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = delegatedDrepId
      ? `/api/governance/summary?drepId=${encodeURIComponent(delegatedDrepId)}`
      : '/api/governance/summary';

    fetch(url)
      .then(res => res.ok ? res.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [delegatedDrepId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-24 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasDrepData = data.drepVotedCount != null && data.drepMissingCount != null;
  const totalOpen = data.openCount;
  const votedPct = hasDrepData && totalOpen > 0
    ? Math.round((data.drepVotedCount! / totalOpen) * 100)
    : 0;

  const accountabilityColor = hasDrepData
    ? votedPct >= 80 ? 'bg-green-500' : votedPct >= 40 ? 'bg-amber-500' : 'bg-red-500'
    : 'bg-muted';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scroll className="h-4 w-4" />
          Governance Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Open proposals summary */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold tabular-nums">{data.openCount}</p>
            <p className="text-xs text-muted-foreground">Open Proposals</p>
          </div>
          <div className="flex gap-2">
            {data.criticalOpenCount > 0 && (
              <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {data.criticalOpenCount} critical
              </Badge>
            )}
            {data.importantOpenCount > 0 && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {data.importantOpenCount} important
              </Badge>
            )}
          </div>
        </div>

        {/* DRep accountability (connected + delegated only) */}
        {hasDrepData && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">DRep Accountability</span>
              <span className="font-medium tabular-nums">
                {data.drepVotedCount} / {totalOpen} voted
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${accountabilityColor}`}
                style={{ width: `${votedPct}%` }}
              />
            </div>
            {data.drepMissingCount! > 0 && (
              <p className="text-xs text-muted-foreground">
                Your DRep hasn&apos;t voted on {data.drepMissingCount} open proposal{data.drepMissingCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {!hasDrepData && (
          <p className="text-xs text-muted-foreground">
            Connect your wallet to see how your DRep is representing you.
          </p>
        )}

        {/* Recent DRep votes */}
        {data.recentVotes && data.recentVotes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent DRep Votes</p>
            {data.recentVotes.map((v, i) => {
              const VoteIcon = VOTE_ICONS[v.vote] || CheckCircle2;
              const color = VOTE_COLORS[v.vote] || '';
              return (
                <Link
                  key={i}
                  href={`/proposals/${v.txHash}/${v.index}`}
                  className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                >
                  <VoteIcon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                  <span className="truncate flex-1">{v.title}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${color}`}>
                    {v.vote}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}

        {/* CTAs */}
        <div className="flex gap-2">
          {delegatedDrepId && (
            <Link href="/governance" className="flex-1">
              <Button variant="default" size="sm" className="w-full gap-1">
                My Governance
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          <Link href="/proposals" className={delegatedDrepId ? 'flex-1' : 'w-full'}>
            <Button variant="outline" size="sm" className="w-full gap-1">
              {delegatedDrepId ? 'Proposals' : 'View All Proposals'}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
