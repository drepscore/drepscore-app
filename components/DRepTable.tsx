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
import { formatAda, getDRepScoreBadgeClass } from '@/utils/scoring';
import { EnrichedDRep } from '@/lib/koios';
import { CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { SortConfig, SortKey } from './DRepTableClient';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScoreBreakdown } from './ScoreBreakdown';
import { SocialIcons } from './SocialIcons';

interface DRepTableProps {
  dreps: EnrichedDRep[];
  sortConfig?: SortConfig;
  onSort?: (key: SortKey) => void;
}

export function DRepTable({ dreps, sortConfig, onSort }: DRepTableProps) {
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
              tooltip="A 0-100 score based on Decentralization (40%), Participation (25%), Rationale (25%), and Influence (10%)."
            />
            
            <TableHead className="text-left font-semibold">DRep</TableHead>
            
            <SortableHeader 
              columnKey="decentralizationScore" 
              label="Decentralization" 
              tooltip="Score based on voting independence and power distribution (40% of total)."
              align="right"
            />

            <SortableHeader 
              columnKey="participationRate" 
              label="Participation" 
              tooltip="Percentage of governance actions voted on."
              align="right"
            />
            
            <SortableHeader 
              columnKey="rationaleRate" 
              label="Rationale" 
              tooltip="Percentage of votes that include a written explanation."
              align="right"
            />

            <SortableHeader 
              columnKey="influenceScore" 
              label="Influence" 
              tooltip="Percentile rank of this DRep's voting power among all DReps. A score of 85 means this DRep has more voting power than 85% of other DReps. Weighted at 10% in the total score."
              align="right"
            />

            <SortableHeader 
              columnKey="votingPower" 
              label="Voting Power" 
              tooltip="Total ADA delegated to this DRep. This raw value is converted to an 'Influence' percentile rank for scoring purposes."
              align="right"
            />
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

              <TableCell className="text-right tabular-nums text-muted-foreground">
                {drep.decentralizationScore}
              </TableCell>

              <TableCell className="text-right tabular-nums text-muted-foreground">
                {drep.participationRate}%
              </TableCell>

              <TableCell className="text-right tabular-nums text-muted-foreground">
                {drep.rationaleRate}%
              </TableCell>

              <TableCell className="text-right tabular-nums text-muted-foreground">
                {drep.influenceScore ?? 0}
              </TableCell>

              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatAda(drep.votingPower)} ADA
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
