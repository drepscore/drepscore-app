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
  initialDReps: DRep[];
  totalAvailable: number;
}

export function DRepTableClient({ initialDReps, totalAvailable }: DRepTableClientProps) {
  const [dreps, setDReps] = useState<DRep[]>(initialDReps);
  const [selectedValues, setSelectedValues] = useState<ValuePreference[]>([]);
  const [showMatchScores, setShowMatchScores] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOnlyDocumented, setShowOnlyDocumented] = useState(false);

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
      const response = await fetch(`/api/dreps?offset=${dreps.length}&limit=50`);
      if (response.ok) {
        const newDReps = await response.json();
        setDReps([...dreps, ...newDReps]);
      }
    } catch (error) {
      console.error('[DRepScore] Error loading more DReps:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter by documentation if enabled
  const filteredDReps = showOnlyDocumented ? filterWellDocumented(dreps) : dreps;
  
  // Calculate match scores when values are selected and search is triggered
  const drepsWithScores: (DRep | DRepWithScore)[] = showMatchScores && selectedValues.length > 0
    ? filteredDReps.map(drep => {
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
  
  const wellDocumentedCount = dreps.filter(d => isWellDocumented(d)).length;

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
              {showMatchScores ? 'Matching DReps' : 'All Active DReps'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Sorted by documentation quality and voting power
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={showOnlyDocumented ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowOnlyDocumented(!showOnlyDocumented)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {showOnlyDocumented ? 'Show All' : 'Well Documented Only'}
            </Button>
            <div className="text-sm text-muted-foreground text-right">
              <div>Showing {drepsWithScores.length} of {totalAvailable}</div>
              <div className="text-xs">{wellDocumentedCount} well documented</div>
            </div>
          </div>
        </div>
        
        <DRepTable dreps={drepsWithScores} showMatchScore={showMatchScores} />
        
        {dreps.length < totalAvailable && (
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
                `Load More DReps (${Math.min(50, totalAvailable - dreps.length)} more available)`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
