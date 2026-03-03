'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface PoolData {
  poolId: string;
  voteCount: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

function PoolsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 space-y-3">
      <p className="text-muted-foreground text-sm">
        No SPO governance votes recorded yet.
      </p>
      <p className="text-xs text-muted-foreground/70">
        Stake pool operators will appear here once they participate in on-chain governance.
      </p>
    </div>
  );
}

export function PoolsDiscovery() {
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/governance/pools')
      .then((r) => (r.ok ? r.json() : { pools: [] }))
      .then((data) => setPools(data.pools || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PoolsSkeleton />;
  if (pools.length === 0) return <EmptyState />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pools.map((pool) => (
        <Link key={pool.poolId} href={`/pool/${pool.poolId}`}>
          <Card className="hover:border-cyan-500/40 transition-colors cursor-pointer">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm truncate">
                  {pool.poolId.slice(0, 16)}…
                </span>
                <Badge variant="outline" className="text-cyan-500 border-cyan-500/40">
                  {pool.voteCount} votes
                </Badge>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-green-500">{pool.yesCount} Yes</span>
                <span className="text-red-500">{pool.noCount} No</span>
                <span>{pool.abstainCount} Abstain</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
