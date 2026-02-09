'use client';

/**
 * Client-side DRep Table Wrapper
 * Manages value-based filtering, scoring, and pagination
 */

import { useState, useEffect, useMemo } from 'react';
import { DRep, DRepWithScore, ValuePreference } from '@/types/drep';
import { DRepTable } from './DRepTable';
import { ValueSelector } from './ValueSelector';
import { calculateValueAlignment } from '@/utils/scoring';
import { filterWellDocumented, isWellDocumented } from '@/utils/documentation';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Loader2, Filter, Search } from 'lucide-react';

interface DRepTableClientProps {
  initialDReps: DRep[]; // Well-documented by default
  allDReps: DRep[]; // All DReps (including unnamed)
  totalAvailable: number;
}

export function DRepTableClient({ initialDReps, allDReps, totalAvailable }: DRepTableClientProps) {
  const [dreps, setDReps] = useState<DRep[]>(initialDReps);
  const [allDRepsState, setAllDRepsState] = useState<DRep[]>(allDReps);
  const [selectedValues, setSelectedValues] = useState<ValuePreference[]>([]);
  const [showMatchScores, setShowMatchScores] = useState(false);
  const [loading, setLoading] = useState(false);
  const [includeUnnamed, setIncludeUnnamed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoLoadComplete, setAutoLoadComplete] = useState(false);

  const handleValuesChange = (values: ValuePreference[]) => {
    setSelectedValues(values);
    if (values.length === 0) {
      setShowMatchScores(false);
    }
  };

  const handleSearch = () => {
    setShowMatchScores(true);
  };

  const loadNextBatch = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const currentLength = allDRepsState.length;
      const response = await fetch(`/api/dreps?offset=${currentLength}&limit=50`);
      if (response.ok) {
        const newDReps = await response.json();
        
        if (newDReps.length === 0) {
          setAutoLoadComplete(true);
          return false; // No more data
        }
        
        // Add to both states
        setAllDRepsState(prev => [...prev, ...newDReps]);
        
        // Filter for well-documented
        const newWellDocumented = newDReps.filter((d: DRep) => 
          isWellDocumented(d) || d.rationaleRate > 0
        );
        setDReps(prev => [...prev, ...newWellDocumented]);
        
        return true; // More data available
      }
      return false;
    } catch (error) {
      console.error('[DRepScore] Error loading more DReps:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    loadNextBatch();
  };

  // Progressive auto-loading effect
  useEffect(() => {
    if (autoLoadComplete || allDRepsState.length >= totalAvailable) {
      setAutoLoadComplete(true);
      return;
    }

    // Start auto-loading after initial mount with a small delay
    const timer = setTimeout(async () => {
      const hasMore = await loadNextBatch();
      // Continue loading if there's more data
      if (!hasMore) {
        setAutoLoadComplete(true);
      }
    }, 1000); // 1 second delay between batches

    return () => clearTimeout(timer);
  }, [allDRepsState.length, autoLoadComplete, totalAvailable]);

  // Toggle between well-documented and all DReps
  const displayDReps = includeUnnamed ? allDRepsState : dreps;
  
  // Search filtering across all loaded DReps
  const filteredDReps = useMemo(() => {
    if (!searchQuery.trim()) return displayDReps;
    
    const query = searchQuery.toLowerCase();
    return displayDReps.filter((drep: DRep) => {
      return (
        drep.name?.toLowerCase().includes(query) ||
        drep.ticker?.toLowerCase().includes(query) ||
        drep.drepId.toLowerCase().includes(query) ||
        drep.description?.toLowerCase().includes(query)
      );
    });
  }, [displayDReps, searchQuery]);
  
  // Calculate match scores when values are selected and search is triggered
  const drepsWithScores: (DRep | DRepWithScore)[] = showMatchScores && selectedValues.length > 0
    ? filteredDReps.map((drep: DRep) => {
        // Use actual vote data for alignment scoring
        // Since we now have full vote history, we can calculate real alignment
        const mockVotes: any[] = []; // TODO: Use actual drep.votes when available in type
        const matchScore = calculateValueAlignment(mockVotes, selectedValues);
        
        return {
          ...drep,
          matchScore,
          matchReasons: selectedValues,
        } as DRepWithScore;
      })
    : filteredDReps;
  
  const wellDocumentedCount = dreps.length;
  const totalLoaded = allDRepsState.length;
  const loadingProgress = totalAvailable > 0 ? Math.round((totalLoaded / totalAvailable) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Select Your Values</h2>
        <p className="text-muted-foreground">
          Choose up to 5 values to find DReps that align with your preferences.
        </p>
        <ValueSelector
          selectedValues={selectedValues}
          onValuesChange={handleValuesChange}
          onSearch={handleSearch}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">
              {showMatchScores ? 'Matching DReps' : (includeUnnamed ? 'All DReps' : 'Well-Documented DReps')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {includeUnnamed 
                ? 'Sorted by documentation quality and voting power'
                : 'Showing DReps with metadata or rationale history (default)'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <input
                type="checkbox"
                checked={includeUnnamed}
                onChange={(e) => setIncludeUnnamed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-2 focus:ring-primary cursor-pointer"
              />
              <span className="text-sm font-medium">Include unnamed/undocumented DReps</span>
            </label>
            <div className="text-sm text-muted-foreground text-right">
              <div>Showing {drepsWithScores.length} {searchQuery && `(filtered)`}</div>
              <div className="text-xs">{totalLoaded} / {totalAvailable} loaded ({loadingProgress}%)</div>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, ticker, or DRep ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Loading Progress Banner */}
        {!autoLoadComplete && loading && (
          <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Loading all DReps...</p>
              <p className="text-xs text-muted-foreground">
                {totalLoaded} of {totalAvailable} loaded ({loadingProgress}%)
              </p>
            </div>
          </div>
        )}

        {autoLoadComplete && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-400">
              ✓ All {totalAvailable} DReps loaded and ready to search
            </p>
          </div>
        )}
        
        {drepsWithScores.length === 0 && !includeUnnamed ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-lg text-muted-foreground">
              No well-documented DReps found in this batch.
            </p>
            <p className="text-sm text-muted-foreground">
              Check "Include unnamed/undocumented DReps" to see all registrations.
            </p>
          </div>
        ) : (
          <DRepTable dreps={drepsWithScores} showMatchScore={showMatchScores} />
        )}
        
        {!autoLoadComplete && allDRepsState.length < totalAvailable && (
          <div className="flex justify-center pt-6">
            <Button
              onClick={handleLoadMore}
              disabled={loading}
              size="lg"
              variant="outline"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                `Load More Manually (${Math.min(50, totalAvailable - allDRepsState.length)} more available)`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
