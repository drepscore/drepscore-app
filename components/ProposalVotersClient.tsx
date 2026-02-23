'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProposalVoteDetail } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, User } from 'lucide-react';

interface ProposalVotersClientProps {
  votes: ProposalVoteDetail[];
}

type VoteFilter = 'all' | 'Yes' | 'No' | 'Abstain';

export function ProposalVotersClient({ votes }: ProposalVotersClientProps) {
  const [filter, setFilter] = useState<VoteFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [expandedRationales, setExpandedRationales] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const result = filter === 'all' ? votes : votes.filter(v => v.vote === filter);
    return result;
  }, [votes, filter]);

  const visible = showAll ? filtered : filtered.slice(0, 20);

  const toggleRationale = (txHash: string) => {
    setExpandedRationales(prev => {
      const next = new Set(prev);
      if (next.has(txHash)) next.delete(txHash); else next.add(txHash);
      return next;
    });
  };

  const yesCt = votes.filter(v => v.vote === 'Yes').length;
  const noCt = votes.filter(v => v.vote === 'No').length;
  const abCt = votes.filter(v => v.vote === 'Abstain').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>DRep Votes ({votes.length})</CardTitle>
          <div className="flex gap-1.5">
            {([
              { key: 'all', label: `All (${votes.length})` },
              { key: 'Yes', label: `Yes (${yesCt})` },
              { key: 'No', label: `No (${noCt})` },
              { key: 'Abstain', label: `Abstain (${abCt})` },
            ] as const).map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(key)}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visible.map((v) => {
            const isExpanded = expandedRationales.has(v.voteTxHash);
            const hasLongRationale = v.rationaleText && v.rationaleText.length > 200;

            return (
              <div
                key={v.voteTxHash}
                className="border rounded-lg p-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={v.vote === 'Yes' ? 'default' : v.vote === 'No' ? 'destructive' : 'secondary'}
                        className="shrink-0"
                      >
                        {v.vote}
                      </Badge>
                      <Link
                        href={`/drep/${encodeURIComponent(v.drepId)}`}
                        className="text-sm font-medium hover:text-primary transition-colors truncate"
                      >
                        {v.drepName || `${v.drepId.slice(0, 16)}...${v.drepId.slice(-8)}`}
                      </Link>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {new Date(v.blockTime * 1000).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>

                    {/* Rationale */}
                    {v.rationaleText && (
                      <div className="mt-2">
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {hasLongRationale && !isExpanded
                            ? v.rationaleText.slice(0, 200) + '...'
                            : v.rationaleText}
                        </p>
                        {hasLongRationale && (
                          <button
                            onClick={() => toggleRationale(v.voteTxHash)}
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 font-medium"
                          >
                            {isExpanded ? (
                              <>Show less <ChevronUp className="h-3 w-3" /></>
                            ) : (
                              <>Read more <ChevronDown className="h-3 w-3" /></>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {v.metaUrl && !v.rationaleText && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Rationale submitted — being fetched from IPFS.
                      </p>
                    )}
                  </div>

                  {/* Link to DRep profile */}
                  <Link
                    href={`/drep/${encodeURIComponent(v.drepId)}`}
                    className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
                  >
                    <User className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length > 20 && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowAll(!showAll)}
              className="w-full"
            >
              {showAll ? (
                <>Show less <ChevronUp className="h-4 w-4 ml-2" /></>
              ) : (
                <>Show all {filtered.length} voters <ChevronDown className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">
            No votes match the current filter.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
