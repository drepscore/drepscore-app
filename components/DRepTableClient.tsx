'use client';

/**
 * DRep Table Client Wrapper
 * Handles client-side pagination, sorting, filtering, and search
 */

import { useState, useMemo } from 'react';
import { DRepTable } from '@/components/DRepTable';
import { EmptyState } from '@/components/EmptyState';
import { EnrichedDRep } from '@/lib/koios';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DRepTableClientProps {
  initialDReps: EnrichedDRep[];
  allDReps: EnrichedDRep[];
  totalAvailable: number;
}

export type SortKey = 'drepScore' | 'votingPower' | 'participationRate' | 'rationaleRate' | 'decentralizationScore';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const PAGE_SIZE = 10;

export function DRepTableClient({
  initialDReps,
  allDReps,
  totalAvailable,
}: DRepTableClientProps) {
  // State
  const [filterWellDocumented, setFilterWellDocumented] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'drepScore',
    direction: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Filter Logic
  const filteredDReps = useMemo(() => {
    // 1. Filter by "Well Documented" toggle
    // If filterWellDocumented is true, use initialDReps (which are already filtered server-side)
    // If false, use allDReps.
    let baseSet = filterWellDocumented ? initialDReps : allDReps;

    // 2. Filter by Search Query
    if (!searchQuery.trim()) return baseSet;

    const query = searchQuery.toLowerCase();
    return baseSet.filter((drep) => {
      const name = drep.name?.toLowerCase() || '';
      const ticker = drep.ticker?.toLowerCase() || '';
      const id = drep.drepId.toLowerCase();
      const handle = drep.handle?.toLowerCase() || '';
      
      return name.includes(query) || 
             ticker.includes(query) || 
             id.includes(query) || 
             handle.includes(query);
    });
  }, [filterWellDocumented, searchQuery, allDReps, initialDReps]);

  // Sorting Logic
  const sortedDReps = useMemo(() => {
    return [...filteredDReps].sort((a, b) => {
      const aValue = a[sortConfig.key] ?? 0;
      const bValue = b[sortConfig.key] ?? 0;

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDReps, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedDReps.length / PAGE_SIZE);
  const paginatedDReps = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return sortedDReps.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedDReps, currentPage]);

  // Handlers
  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
    setCurrentPage(1); // Reset to first page on sort
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleReset = () => {
    setSearchQuery('');
    setSortConfig({ key: 'drepScore', direction: 'desc' });
    setFilterWellDocumented(true);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 rounded-lg border bg-card/50 backdrop-blur-sm">
        
        {/* Left: Search */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Name, Ticker, ID, or Handle..."
            value={searchQuery}
            onChange={handleSearch}
            className="pl-9 bg-background/50 border-primary/20 focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Right: Toggles & Reset */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <Switch
              id="filter-well-documented"
              checked={filterWellDocumented}
              onCheckedChange={(checked) => {
                setFilterWellDocumented(checked);
                setCurrentPage(1);
              }}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label htmlFor="filter-well-documented" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                    Filter: Well-Documented Only
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    When enabled (default), only shows DReps that have provided metadata (name, description) OR have explained at least one vote.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleReset}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Results Info */}
      <div className="text-sm text-muted-foreground px-1">
        Showing {sortedDReps.length} DReps
        {totalAvailable > 0 && ` (${totalAvailable} registered)`}
      </div>

      {/* Table Content */}
      {paginatedDReps.length === 0 ? (
        <EmptyState
          title="No DReps found"
          message={
            searchQuery
              ? `No results matching "${searchQuery}"`
              : "Try adjusting your filters."
          }
          icon="search"
          action={
            filterWellDocumented && !searchQuery
              ? {
                  label: 'Show all DReps',
                  onClick: () => setFilterWellDocumented(false),
                }
              : {
                  label: 'Clear Filters',
                  onClick: handleReset,
                }
          }
        />
      ) : (
        <>
          <DRepTable 
            dreps={paginatedDReps} 
            sortConfig={sortConfig}
            onSort={handleSort}
          />
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
