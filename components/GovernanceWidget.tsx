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
  Wallet,
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const url = delegatedDrepId
      ? `/api/governance/summary?drepId=${encodeURIComponent(delegatedDrepId)}`
      : '/api/governance/summary';

    fetch(url)
      .then(res => res.ok ? res.json() : null)
      .then(d => { setData(d); setTimeout(() => setMounted(true), 50); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [delegatedDrepId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasDrepData = data.drepVotedCount != null && data.drepMissingCount != null;
  const totalOpen = data.openCount;
  const votedPct = hasDrepData && totalOpen > 0 && data.drepVotedCount != null
    ? Math.round((data.drepVotedCount / totalOpen) * 100)
    : 0;

  const hasCritical = data.criticalOpenCount > 0;
  const allVoted = hasDrepData && data.drepMissingCount === 0;
  const borderColor = hasCritical
    ? 'border-l-red-500'
    : allVoted
    ? 'border-l-green-500'
    : 'border-l-primary';

  const accountabilityColor = hasDrepData
    ? votedPct >= 80 ? 'bg-green-500' : votedPct >= 40 ? 'bg-amber-500' : 'bg-red-500'
    : 'bg-muted';

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Scroll className="h-4 w-4" />
          Governance Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tabular-nums">{data.openCount}</span>
          <span className="text-xs text-muted-foreground">Open Proposals</span>
          <div className="flex gap-1.5 ml-auto">
            {data.criticalOpenCount > 0 && (
              <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 gap-1 text-[10px] px-1.5">
                <AlertTriangle className="h-3 w-3" />
                {data.criticalOpenCount} critical
              </Badge>
            )}
            {data.importantOpenCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-1.5">
                {data.importantOpenCount} important
              </Badge>
            )}
          </div>
        </div>

        {hasDrepData && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">DRep Accountability</span>
              <span className="font-medium tabular-nums">
                {data.drepVotedCount} / {totalOpen} voted · {votedPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${accountabilityColor}`}
                style={{ width: mounted ? `${votedPct}%` : '0%' }}
              />
            </div>
            {data.drepMissingCount != null && data.drepMissingCount > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {data.drepMissingCount} open proposal{data.drepMissingCount !== 1 ? 's' : ''} awaiting vote
              </p>
            )}
          </div>
        )}

        {!hasDrepData && (
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
            <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Connect your wallet to see how your DRep is representing you.
            </p>
          </div>
        )}

        {/* Recent DRep votes */}
        {data.recentVotes && data.recentVotes.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Recent DRep Votes</p>
            {data.recentVotes.map((v, i) => {
              const VoteIcon = VOTE_ICONS[v.vote] || CheckCircle2;
              const color = VOTE_COLORS[v.vote] || '';
              return (
                <Link
                  key={i}
                  href={`/proposals/${v.txHash}/${v.index}`}
                  className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-1.5 py-1 -mx-1.5 transition-colors"
                >
                  <VoteIcon className={`h-3 w-3 shrink-0 ${color}`} />
                  <span className="truncate flex-1">{v.title}</span>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${color} px-1`}>
                    {v.vote}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {delegatedDrepId && (
            <Link href="/governance" className="flex-1">
              <Button variant="default" size="sm" className="w-full gap-1 text-xs h-8">
                My Governance
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
          <Link href="/proposals" className={delegatedDrepId ? 'flex-1' : 'w-full'}>
            <Button variant="outline" size="sm" className="w-full gap-1 text-xs h-8">
              {delegatedDrepId ? 'Proposals' : 'View All Proposals'}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
