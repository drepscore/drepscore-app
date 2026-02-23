'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProposalVoteDetail } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, User, Search, Heart, UserCheck } from 'lucide-react';
import { MarkdownContent } from '@/components/MarkdownContent';

interface ProposalVotersClientProps {
  votes: ProposalVoteDetail[];
  watchlist?: string[];
  delegatedDrepId?: string | null;
}

type VoteFilter = 'all' | 'Yes' | 'No' | 'Abstain';

export function ProposalVotersClient({
  votes,
  watchlist = [],
  delegatedDrepId,
}: ProposalVotersClientProps) {
  const [filter, setFilter] = useState<VoteFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [expandedRationales, setExpandedRationales] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const filtered = useMemo(() => {
    let result = filter === 'all' ? votes : votes.filter(v => v.vote === filter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v =>
        (v.drepName || '').toLowerCase().includes(q) ||
        v.drepId.toLowerCase().includes(q)
      );
    }

    if (showWatchlistOnly && watchlist.length > 0) {
      const wSet = new Set(watchlist);
      result = result.filter(v => wSet.has(v.drepId));
    }

    // Pin delegated DRep to the top
    if (delegatedDrepId) {
      const pinned = result.filter(v => v.drepId === delegatedDrepId);
      const rest = result.filter(v => v.drepId !== delegatedDrepId);
      result = [...pinned, ...rest];
    }

    return result;
  }, [votes, filter, searchQuery, showWatchlistOnly, watchlist, delegatedDrepId]);

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

        {/* Search + quick filters */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search DReps by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>

          {delegatedDrepId && votes.some(v => v.drepId === delegatedDrepId) && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <UserCheck className="h-3 w-3" />
              Your DRep voted
            </Badge>
          )}

          {watchlist.length > 0 && (
            <Button
              variant={showWatchlistOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
              className="gap-1 text-xs h-8"
            >
              <Heart className="h-3 w-3" />
              Watchlist
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visible.map((v) => {
            const isExpanded = expandedRationales.has(v.voteTxHash);
            const hasLongRationale = v.rationaleText && v.rationaleText.length > 200;
            const isMyDrep = delegatedDrepId === v.drepId;

            return (
              <div
                key={v.voteTxHash}
                className={`border rounded-lg p-3 hover:bg-muted/20 transition-colors ${isMyDrep ? 'ring-1 ring-primary/40 bg-primary/5' : ''}`}
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
                      {isMyDrep && (
                        <Badge variant="outline" className="text-xs gap-1 bg-primary/10 border-primary/30">
                          <UserCheck className="h-2.5 w-2.5" />
                          Your DRep
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {new Date(v.blockTime * 1000).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>

                    {/* Rationale */}
                    {v.rationaleText && (
                      <div className="mt-2">
                        {hasLongRationale && !isExpanded ? (
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            {v.rationaleText.slice(0, 200)}...
                          </p>
                        ) : (
                          <MarkdownContent content={v.rationaleText} className="text-xs text-foreground/80 leading-relaxed" />
                        )}
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
