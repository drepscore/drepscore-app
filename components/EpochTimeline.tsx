'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EpochRecap {
  epoch: number;
  proposals_submitted: number;
  proposals_ratified: number;
  drep_participation_pct: number;
  treasury_withdrawn_ada: number;
  ai_narrative: string | null;
}

const PAGE_SIZE = 20;

export function EpochTimeline({ initialRecaps }: { initialRecaps: EpochRecap[] }) {
  const [recaps, setRecaps] = useState(initialRecaps);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialRecaps.length >= PAGE_SIZE);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const lastEpoch = recaps[recaps.length - 1]?.epoch;
    if (lastEpoch == null) return;

    try {
      const res = await fetch(
        `/api/governance/epoch-recap?before=${lastEpoch}&limit=${PAGE_SIZE}`,
      );
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const newRecaps: EpochRecap[] = await res.json();
      if (newRecaps.length < PAGE_SIZE) setHasMore(false);
      setRecaps((prev) => [...prev, ...newRecaps]);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  if (recaps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No epoch recaps available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        {recaps.map((recap) => (
          <div key={recap.epoch} className="relative pl-12 pb-8">
            <div className="absolute left-[11px] top-1 w-[10px] h-[10px] rounded-full bg-primary border-2 border-background" />

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Epoch {recap.epoch}</CardTitle>
                  <Link
                    href={`/pulse/report/${recap.epoch}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Full report &rarr;
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {recap.proposals_submitted} submitted
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {recap.proposals_ratified} ratified
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(recap.drep_participation_pct)}% participation
                  </Badge>
                  {recap.treasury_withdrawn_ada > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {formatAda(recap.treasury_withdrawn_ada)} withdrawn
                    </Badge>
                  )}
                </div>
              </CardHeader>
              {recap.ai_narrative && (
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {recap.ai_narrative}
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load older epochs'}
          </Button>
        </div>
      )}
    </div>
  );
}

function formatAda(lovelaceOrAda: number): string {
  const ada = lovelaceOrAda > 1_000_000 ? lovelaceOrAda / 1_000_000 : lovelaceOrAda;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M ADA`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K ADA`;
  return `${Math.round(ada)} ADA`;
}
