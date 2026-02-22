'use client';

/**
 * DRep Table Component
 * Displays DReps with DRep Score as primary column (first, default sort)
 * Includes sortable headers and tooltips
 */

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDRepDisplayName } from '@/utils/display';
import { formatAda, getDRepScoreBadgeClass, getSizeBadgeClass } from '@/utils/scoring';
import { EnrichedDRep } from '@/lib/koios';
import { CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, Info, Heart } from 'lucide-react';
import { SortConfig, SortKey } from './DRepTableClient';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScoreBreakdown } from './ScoreBreakdown';
import { SocialIcons } from './SocialIcons';
import { cn } from '@/lib/utils';

interface DRepTableProps {
  dreps: EnrichedDRep[];
  sortConfig?: SortConfig;
  onSort?: (key: SortKey) => void;
  watchlist?: string[];
  onWatchlistToggle?: (drepId: string) => void;
}

export function DRepTable({ dreps, sortConfig, onSort, watchlist = [], onWatchlistToggle }: DRepTableProps) {
  const router = useRouter();

  if (dreps.length === 0) {
    return null;
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 text-primary" />
      : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const SortableHeader = ({ 
    columnKey, 
    label, 
    tooltip, 
    align = 'left' 
  }: { 
    columnKey: SortKey, 
    label: string, 
    tooltip: string,
    align?: 'left' | 'right' 
  }) => (
    <TableHead className={`text-${align}`}>
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : ''}`}>
        <Button 
          variant="ghost" 
          onClick={(e) => {
            e.stopPropagation();
            onSort?.(columnKey);
          }}
          className="-ml-4 hover:bg-transparent hover:text-primary font-semibold"
        >
          {label}
          <SortIcon columnKey={columnKey} />
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground ml-1 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </TableHead>
  );

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {/* DRep Score - first column, primary metric */}
            <SortableHeader 
              columnKey="drepScore" 
              label="DRep Score" 
              tooltip="A 0-100 score based on Participation (35%), Rationale (30%), and Decentralization (35%). Hover over the score bar to see the breakdown."
            />
            
            <TableHead className="text-left font-semibold">DRep</TableHead>
            
            <SortableHeader 
              columnKey="sizeTier" 
              label="Size" 
              tooltip="DRep size tier based on voting power. Small (<10k ADA), Medium (10k-1M ADA), Large (1M-10M ADA), or Whale (>10M ADA)."
            />

            <SortableHeader 
              columnKey="votingPower" 
              label="Voting Power" 
              tooltip="Total ADA delegated to this DRep."
              align="right"
            />

            <TableHead className="w-12">
              <span className="sr-only">Watchlist</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dreps.map((drep) => (
            <TableRow 
              key={drep.drepId}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => router.push(`/drep/${encodeURIComponent(drep.drepId)}`)}
            >
              {/* DRep Score */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center min-w-[40px]">
                    <span className="text-xl font-bold tabular-nums text-foreground leading-none">
                      {drep.drepScore ?? 0}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1 py-0 h-4 font-medium mt-1 ${getDRepScoreBadgeClass(drep.drepScore ?? 0)}`}
                    >
                      {(drep.drepScore ?? 0) >= 80 ? 'Strong' : (drep.drepScore ?? 0) >= 60 ? 'Good' : 'Low'}
                    </Badge>
                  </div>
                  <ScoreBreakdown drep={drep} />
                </div>
              </TableCell>

              {/* DRep Identity & Socials */}
              <TableCell>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {getDRepDisplayName(drep)}
                    </span>
                    {(drep.name || drep.ticker || drep.description) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Well Documented: Has metadata (Name/Description)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <SocialIcons metadata={drep.metadata} />
                </div>
              </TableCell>

              {/* Size Tier Badge */}
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${getSizeBadgeClass(drep.sizeTier)}`}
                >
                  {drep.sizeTier}
                </Badge>
              </TableCell>

              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatAda(drep.votingPower)} ADA
              </TableCell>

              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onWatchlistToggle?.(drep.drepId);
                        }}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                        aria-label={watchlist.includes(drep.drepId) ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Heart
                          className={cn(
                            "h-4 w-4 transition-colors",
                            watchlist.includes(drep.drepId)
                              ? "fill-red-500 text-red-500"
                              : "text-muted-foreground hover:text-red-400"
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{watchlist.includes(drep.drepId) ? 'Remove from watchlist' : 'Add to watchlist'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
