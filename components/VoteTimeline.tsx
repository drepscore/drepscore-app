'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VotePoint {
  drepName: string | null;
  drepId: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
}

interface VoteTimelineProps {
  votes: VotePoint[];
  proposalBlockTime: number;
  expirationEpoch: number | null;
  currentEpoch: number;
}

const VOTE_DOT_COLORS: Record<string, string> = {
  Yes: 'bg-green-500',
  No: 'bg-red-500',
  Abstain: 'bg-amber-500',
};

const SHELLEY_GENESIS = 1596491091;
const EPOCH_LENGTH = 432000;
const SHELLEY_BASE_EPOCH = 208;

function epochToTimestamp(epoch: number): number {
  return SHELLEY_GENESIS + (epoch - SHELLEY_BASE_EPOCH) * EPOCH_LENGTH;
}

export function VoteTimeline({ votes, proposalBlockTime, expirationEpoch, currentEpoch }: VoteTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  if (votes.length < 3) return null;

  const startTime = proposalBlockTime;
  const endTime = expirationEpoch
    ? epochToTimestamp(expirationEpoch)
    : Math.max(...votes.map(v => v.blockTime), Date.now() / 1000);
  const span = endTime - startTime;

  if (span <= 0) return null;

  const sortedVotes = [...votes].sort((a, b) => a.blockTime - b.blockTime);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="text-sm flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Vote Timeline
          <span className="text-xs font-normal text-muted-foreground">({votes.length} votes)</span>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Yes</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> No</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Abstain</span>
          </div>

          <div className="relative h-8">
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-muted rounded-full" />

            <TooltipProvider>
              {sortedVotes.map((v, i) => {
                const position = ((v.blockTime - startTime) / span) * 100;
                const clampedPos = Math.max(1, Math.min(99, position));
                const date = new Date(v.blockTime * 1000).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                });

                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-card cursor-help transition-transform hover:scale-150 ${VOTE_DOT_COLORS[v.vote]}`}
                        style={{ left: `${clampedPos}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{v.drepName || v.drepId.slice(0, 16) + '...'}</p>
                      <p className="text-xs text-muted-foreground">{v.vote} · {date}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>

          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>
              {new Date(startTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span>
              {expirationEpoch ? `Epoch ${expirationEpoch}` : 'Now'}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
