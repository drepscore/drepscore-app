'use client';

/**
 * Client-side DRep Table Wrapper
 * Manages value-based filtering, scoring, and pagination
 */

import { useState } from 'react';
import { DRep, DRepWithScore, ValuePreference } from '@/types/drep';
import { DRepTable } from './DRepTable';
import { ValueSelector } from './ValueSelector';
import { calculateValueAlignment } from '@/utils/scoring';
import { filterWellDocumented, isWellDocumented } from '@/utils/documentation';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, Filter } from 'lucide-react';

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

  const handleValuesChange = (values: ValuePreference[]) => {
    setSelectedValues(values);
    if (values.length === 0) {
      setShowMatchScores(false);
    }
  };

  const handleSearch = () => {
    setShowMatchScores(true);
  };

  const handleLoadMore = async () => {
    setLoading(true);
    try {
      const currentLength = includeUnnamed ? allDRepsState.length : dreps.length;
      const response = await fetch(`/api/dreps?offset=${currentLength}&limit=50`);
      if (response.ok) {
        const newDReps = await response.json();
        
        // Add to both states
        setAllDRepsState([...allDRepsState, ...newDReps]);
        
        // Filter for well-documented
        const newWellDocumented = newDReps.filter((d: DRep) => 
          isWellDocumented(d) || d.rationaleRate > 0
        );
        setDReps([...dreps, ...newWellDocumented]);
      }
    } catch (error) {
      console.error('[DRepScore] Error loading more DReps:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle between well-documented and all DReps
  const displayDReps = includeUnnamed ? allDRepsState : dreps;
  
  // Calculate match scores when values are selected and search is triggered
  const drepsWithScores: (DRep | DRepWithScore)[] = showMatchScores && selectedValues.length > 0
    ? displayDReps.map((drep: DRep) => {
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
    : displayDReps;
  
  const wellDocumentedCount = dreps.length;
  const totalLoaded = allDRepsState.length;

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
              <div>Showing {drepsWithScores.length} of {totalLoaded} loaded</div>
              <div className="text-xs">{wellDocumentedCount} well documented</div>
            </div>
          </div>
        </div>
        
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
        
        {(includeUnnamed ? allDRepsState.length : dreps.length) < totalAvailable && (
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
                  Loading Complete Data...
                </>
              ) : (
                `Load More DReps (${Math.min(50, totalAvailable - (includeUnnamed ? allDRepsState.length : dreps.length))} more available)`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
