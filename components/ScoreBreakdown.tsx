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

  // Safe values defaulting to 0
  const safeDecentralization = typeof drep.decentralizationScore === 'number' ? drep.decentralizationScore : 0;
  const safeParticipation = typeof drep.participationRate === 'number' ? drep.participationRate : 0;
  const safeRationale = typeof drep.rationaleRate === 'number' ? drep.rationaleRate : 0;
  const safeDRepScore = typeof drep.drepScore === 'number' ? drep.drepScore : 0;

  // Calculate known component contribution
  const knownContribution = 
    (safeDecentralization * WEIGHTS.decentralization) +
    (safeParticipation * WEIGHTS.participation) +
    (safeRationale * WEIGHTS.rationale);
  
  // Back-calculate Influence score
  // Total Score = knownContribution + (Influence * 0.10)
  // Influence = (Total Score - knownContribution) / 0.10
  const rawInfluence = (safeDRepScore - knownContribution) / WEIGHTS.influence;
  const influenceScore = Math.max(0, Math.min(100, Math.round(Number.isFinite(rawInfluence) ? rawInfluence : 0)));

  const components = [
    {
      label: 'Decentralization',
      value: safeDecentralization,
      weight: WEIGHTS.decentralization,
      color: 'bg-chart-1', // Emerald/Green
    },
    {
      label: 'Participation',
      value: safeParticipation,
      weight: WEIGHTS.participation,
      color: 'bg-chart-2', // Cyan/Blue
    },
    {
      label: 'Rationale',
      value: safeRationale,
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
          const rawPoints = comp.value * comp.weight;
          const points = Math.round(rawPoints);
          const safePoints = Number.isFinite(points) ? points : 0;
          
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
                    Pts: <span className="font-medium text-foreground">{safePoints}</span>
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
