'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface DRepCommunicationFeedProps {
  drepId: string;
}

interface Explanation {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  explanationText: string;
  vote: string | null;
  createdAt: string;
}

interface Position {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  statementText: string;
  createdAt: string;
}

interface FeedData {
  explanations: Explanation[];
  positions: Position[];
  philosophy: string | null;
  drepName: string | null;
}

type FeedItem =
  | { type: 'explanation'; date: string; content: Explanation }
  | { type: 'position'; date: string; content: Position };

export function DRepCommunicationFeed({ drepId }: DRepCommunicationFeedProps) {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [philosophyOpen, setPhilosophyOpen] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    fetch(`/api/governance/drep-feed?drepId=${encodeURIComponent(drepId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [drepId]);

  useEffect(() => {
    if (!tracked.current && !loading) {
      const hasContent = !!(data && (data.explanations.length > 0 || data.positions.length > 0 || data.philosophy));
      posthog.capture('drep_communication_feed_viewed', { drepId, hasContent });
      tracked.current = true;
    }
  }, [loading, data, drepId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            From Your Representative
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasContent = data && (data.explanations.length > 0 || data.positions.length > 0);
  const drepName = data?.drepName || `${drepId.slice(0, 16)}...`;

  const feedItems: FeedItem[] = [];
  if (data) {
    for (const e of data.explanations) {
      feedItems.push({ type: 'explanation', date: e.createdAt, content: e });
    }
    for (const p of data.positions) {
      feedItems.push({ type: 'position', date: p.createdAt, content: p });
    }
  }
  feedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          From Your Representative
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContent && (
          <p className="text-sm text-muted-foreground">
            Your DRep hasn&apos;t shared any explanations or positions yet. DReps who explain their votes score higher.
          </p>
        )}

        {feedItems.length > 0 && (
          <div className="space-y-3">
            {feedItems.map((item, i) => {
              if (item.type === 'explanation') {
                const e = item.content;
                const proposalLabel = e.proposalTitle || `${e.proposalTxHash.slice(0, 12)}...`;
                return (
                  <div key={`e-${i}`} className="border-l-2 border-primary/20 pl-3 py-1">
                    <p className="text-sm">
                      <span className="font-medium">{drepName}</span>
                      {e.vote ? (
                        <> voted <span className="font-medium">{e.vote}</span> on </>
                      ) : (
                        <> explained their vote on </>
                      )}
                      <Link
                        href={`/proposals/${e.proposalTxHash}/${e.proposalIndex}`}
                        className="text-primary hover:underline"
                      >
                        {proposalLabel}
                      </Link>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                      &ldquo;{e.explanationText}&rdquo;
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                );
              }

              const p = item.content;
              const proposalLabel = p.proposalTitle || `${p.proposalTxHash.slice(0, 12)}...`;
              return (
                <div key={`p-${i}`} className="border-l-2 border-violet-400/30 pl-3 py-1">
                  <p className="text-sm">
                    <span className="font-medium">{drepName}</span> stated their position on{' '}
                    <Link
                      href={`/proposals/${p.proposalTxHash}/${p.proposalIndex}`}
                      className="text-primary hover:underline"
                    >
                      {proposalLabel}
                    </Link>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                    &ldquo;{p.statementText}&rdquo;
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {data?.philosophy && (
          <div className="pt-2 border-t">
            <button
              onClick={() => setPhilosophyOpen(!philosophyOpen)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {philosophyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Governance Philosophy
            </button>
            {philosophyOpen && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                {data.philosophy}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
