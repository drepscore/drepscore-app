'use client';

/**
 * Score Breakdown Component
 * Visualizes the components of the DRep Score (Decentralization, Participation, Rationale, Influence)
 */

import { EnrichedDRep } from '@/lib/koios';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScoreBreakdownProps {
  drep: EnrichedDRep;
}

export function ScoreBreakdown({ drep }: ScoreBreakdownProps) {
  // Weights from lib/koios.ts
  const WEIGHTS = {
    decentralization: 0.40,
    participation: 0.25,
    rationale: 0.25,
    influence: 0.10,
  };

  // Calculate raw contributions (0-100 scale)
  // Note: Influence score is calculated during enrichment, but we can approximate or pass it if needed.
  // For visualization, we'll infer it from the total score or just show the known components.
  // Actually, let's just show the raw scores for each component as bars.
  
  // We need to back-calculate Influence score since it's not stored directly on DRep
  // Total Score = sum(component_score * weight)
  // Influence Score = (Total Score - (Decentralization * 0.4 + Participation * 0.25 + Rationale * 0.25)) / 0.10
  const knownScore = 
    ((drep.decentralizationScore ?? 0) * WEIGHTS.decentralization) +
    (drep.participationRate * WEIGHTS.participation) +
    (drep.rationaleRate * WEIGHTS.rationale);
  
  const influenceScore = Math.max(0, Math.min(100, Math.round((drep.drepScore - knownScore) / WEIGHTS.influence)));

  const components = [
    {
      label: 'Decentralization',
      value: drep.decentralizationScore ?? 0,
      weight: WEIGHTS.decentralization,
      color: 'bg-chart-1', // Emerald/Green
    },
    {
      label: 'Participation',
      value: drep.participationRate,
      weight: WEIGHTS.participation,
      color: 'bg-chart-2', // Cyan/Blue
    },
    {
      label: 'Rationale',
      value: drep.rationaleRate,
      weight: WEIGHTS.rationale,
      color: 'bg-chart-3', // Purple/Pink
    },
    {
      label: 'Influence',
      value: influenceScore,
      weight: WEIGHTS.influence,
      color: 'bg-chart-4', // Yellow/Orange
    },
  ];

  return (
    <div className="flex flex-col gap-1 w-24">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/20">
        {components.map((comp) => {
          const points = Math.round(comp.value * comp.weight);
          return (
            <TooltipProvider key={comp.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`h-full ${comp.color} transition-all hover:brightness-110`}
                    style={{ width: `${comp.weight * 100}%`, opacity: Math.max(0.3, comp.value / 100) }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{comp.label}</p>
                  <p>Score: {comp.value}/100</p>
                  <p className="text-xs text-muted-foreground">
                    Points: <span className="font-medium text-foreground">{points}</span>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
