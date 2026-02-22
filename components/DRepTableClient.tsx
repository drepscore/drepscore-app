'use client';

/**
 * DRep Table Client Wrapper
 * Handles client-side pagination, sorting, filtering, and search
 * Fetches data from API route to avoid 128KB server component prop limit
 */

import { useState, useMemo, useEffect } from 'react';
import { DRepTable } from '@/components/DRepTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EnrichedDRep } from '@/lib/koios';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { SizeTier } from '@/utils/scoring';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserPrefKey } from '@/types/drep';
import { applyPreferenceBoost } from '@/utils/userPrefs';

export type SortKey = 'drepScore' | 'votingPower' | 'sizeTier';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const PAGE_SIZE = 10;

interface DRepTableClientProps {
  userPrefs?: UserPrefKey[];
}

export function DRepTableClient({ userPrefs = [] }: DRepTableClientProps) {
  // Data fetching state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialDReps, setInitialDReps] = useState<EnrichedDRep[]>([]);
  const [allDReps, setAllDReps] = useState<EnrichedDRep[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);

  // Fetch data on mount
  useEffect(() => {
    fetch('/api/dreps')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch DReps');
        return res.json();
      })
      .then(data => {
        setInitialDReps(data.dreps || []);
        setAllDReps(data.allDReps || []);
        setTotalAvailable(data.totalAvailable || 0);
        setLoading(false);
        if (data.error) {
          setError('Data may be stale - try refreshing');
        }
      })
      .catch(err => {
        console.error('Error fetching DReps:', err);
        setError('Failed to load DReps. Please try refreshing the page.');
        setLoading(false);
      });
  }, []);
  // State
  const [filterWellDocumented, setFilterWellDocumented] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilters, setSizeFilters] = useState<Set<SizeTier>>(new Set(['Small', 'Medium', 'Large', 'Whale']));
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
    let result = filterWellDocumented ? initialDReps : allDReps;

    // 2. Filter by Size
    result = result.filter((drep) => sizeFilters.has(drep.sizeTier));

    // 3. Filter by Search Query
    if (!searchQuery.trim()) return result;

    const query = searchQuery.toLowerCase();
    return result.filter((drep) => {
      const name = drep.name?.toLowerCase() || '';
      const ticker = drep.ticker?.toLowerCase() || '';
      const id = drep.drepId.toLowerCase();
      const handle = drep.handle?.toLowerCase() || '';
      
      return name.includes(query) || 
             ticker.includes(query) || 
             id.includes(query) || 
             handle.includes(query);
    });
  }, [filterWellDocumented, sizeFilters, searchQuery, allDReps, initialDReps]);

  // Size tier ordering for sorting
  const sizeTierOrder = { 'Small': 1, 'Medium': 2, 'Large': 3, 'Whale': 4 };

  // Sorting Logic
  const sortedDReps = useMemo(() => {
    return [...filteredDReps].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      if (sortConfig.key === 'sizeTier') {
        // Custom ordering for sizeTier
        aValue = sizeTierOrder[a.sizeTier] ?? 0;
        bValue = sizeTierOrder[b.sizeTier] ?? 0;
      } else if (sortConfig.key === 'drepScore') {
        // Use boosted score if user prefs exist
        aValue = applyPreferenceBoost(a, userPrefs);
        bValue = applyPreferenceBoost(b, userPrefs);
      } else {
        aValue = a[sortConfig.key] ?? 0;
        bValue = b[sortConfig.key] ?? 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDReps, sortConfig, userPrefs]);

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
    setSizeFilters(new Set(['Small', 'Medium', 'Large', 'Whale']));
    setCurrentPage(1);
  };

  const toggleSizeFilter = (size: SizeTier) => {
    setSizeFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(size)) {
        newSet.delete(size);
      } else {
        newSet.add(size);
      }
      return newSet;
    });
    setCurrentPage(1);
  };

  // Loading state
  if (loading) {
    return <TableSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <ErrorBanner 
        message={error}
        retryable={true}
      />
    );
  }

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
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end flex-wrap">
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
                    Well-Documented
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    When enabled (default), only shows DReps that have provided metadata (name and description/ticker).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Size Filter
                {sizeFilters.size < 4 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center">
                    {sizeFilters.size}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter by Size</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sizeFilters.has('Small')}
                onCheckedChange={() => toggleSizeFilter('Small')}
              >
                Small (&lt;10k ADA)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sizeFilters.has('Medium')}
                onCheckedChange={() => toggleSizeFilter('Medium')}
              >
                Medium (10k-1M)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sizeFilters.has('Large')}
                onCheckedChange={() => toggleSizeFilter('Large')}
              >
                Large (1M-10M)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sizeFilters.has('Whale')}
                onCheckedChange={() => toggleSizeFilter('Whale')}
              >
                Whale (&gt;10M ADA)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
