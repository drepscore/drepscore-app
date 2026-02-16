'use client';

/**
 * Score Breakdown Component
 * Visualizes the components of the DRep Score (Participation, Rationale, Decentralization)
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
  // Weights from lib/koios.ts (must sum to 1)
  const WEIGHTS = {
    participation: 0.35,
    rationale: 0.30,
    decentralization: 0.35,
  };

  // Safe values defaulting to 0
  const safeParticipation = typeof drep.participationRate === 'number' ? drep.participationRate : 0;
  const safeRationale = typeof drep.rationaleRate === 'number' ? drep.rationaleRate : 0;
  const safeDecentralization = typeof drep.decentralizationScore === 'number' ? drep.decentralizationScore : 0;

  const components = [
    {
      label: 'Participation',
      value: safeParticipation,
      weight: WEIGHTS.participation,
      color: 'bg-chart-1', // Primary color
      description: 'Percentage of governance actions voted on',
    },
    {
      label: 'Rationale',
      value: safeRationale,
      weight: WEIGHTS.rationale,
      color: 'bg-chart-2', // Secondary color
      description: 'Percentage of votes with written explanations',
    },
    {
      label: 'Decentralization',
      value: safeDecentralization,
      weight: WEIGHTS.decentralization,
      color: 'bg-chart-3', // Tertiary color
      description: 'Voting independence and power balance',
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
                  <p className="text-xs text-muted-foreground mb-1">{comp.description}</p>
                  <p>Score: {comp.value}/100</p>
                  <p className="text-xs">
                    Contributes: <span className="font-semibold">{safePoints} pts</span> (weight: {Math.round(comp.weight * 100)}%)
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
