'use client';

/**
 * Client-side DRep Table Wrapper
 * Manages value-based filtering and scoring
 */

import { useState } from 'react';
import { DRep, DRepWithScore, ValuePreference } from '@/types/drep';
import { DRepTable } from './DRepTable';
import { ValueSelector } from './ValueSelector';
import { calculateValueAlignment } from '@/utils/scoring';

interface DRepTableClientProps {
  initialDReps: DRep[];
}

export function DRepTableClient({ initialDReps }: DRepTableClientProps) {
  const [selectedValues, setSelectedValues] = useState<ValuePreference[]>([]);
  const [showMatchScores, setShowMatchScores] = useState(false);

  const handleValuesChange = (values: ValuePreference[]) => {
    setSelectedValues(values);
    if (values.length === 0) {
      setShowMatchScores(false);
    }
  };

  const handleSearch = () => {
    setShowMatchScores(true);
  };

  // Calculate match scores when values are selected and search is triggered
  const drepsWithScores: (DRep | DRepWithScore)[] = showMatchScores && selectedValues.length > 0
    ? initialDReps.map(drep => {
        // For now, use simplified scoring based on available metrics
        // In production, this would use actual vote history
        const mockVotes: any[] = []; // Would be actual vote records
        const matchScore = calculateValueAlignment(mockVotes, selectedValues);
        
        return {
          ...drep,
          matchScore,
          matchReasons: selectedValues,
        } as DRepWithScore;
      })
    : initialDReps;

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
        <h2 className="text-2xl font-bold">
          {showMatchScores ? 'Matching DReps' : 'All Active DReps'}
        </h2>
        <DRepTable dreps={drepsWithScores} showMatchScore={showMatchScores} />
      </div>
    </div>
  );
}
