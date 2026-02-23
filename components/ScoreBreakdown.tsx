'use client';

/**
 * Score Breakdown Component
 * Provides tooltip content for DRep Score breakdown
 * Shows: Effective Participation (45%), Rationale (35%), Consistency (20%)
 */

import { EnrichedDRep } from '@/lib/koios';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReactNode } from 'react';

interface ScoreBreakdownProps {
  drep: EnrichedDRep;
  children: ReactNode;
}

export const WEIGHTS = {
  effectiveParticipation: 0.45,
  rationale: 0.35,
  consistency: 0.20,
};

export function ScoreBreakdownTooltip({ drep, children }: ScoreBreakdownProps) {
  const safeEffectiveParticipation = drep.effectiveParticipation ?? 0;
  const safeRationale = drep.rationaleRate ?? 0;
  const safeConsistency = drep.consistencyScore ?? 0;
  const deliberationModifier = drep.deliberationModifier ?? 1.0;
  const hasRubberStampDiscount = deliberationModifier < 1.0;

  const components = [
    {
      label: 'Effective Participation',
      value: safeEffectiveParticipation,
      weight: WEIGHTS.effectiveParticipation,
      description: 'How consistently this DRep votes. Discounted if voting pattern suggests rubber-stamping.',
    },
    {
      label: 'Rationale',
      value: safeRationale,
      weight: WEIGHTS.rationale,
      description: 'How often this DRep explains their votes.',
    },
    {
      label: 'Consistency',
      value: safeConsistency,
      weight: WEIGHTS.consistency,
      description: 'How steadily this DRep participates over time.',
    },
  ];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold text-sm">Score Breakdown</p>
            {components.map((comp) => {
              const points = Math.round(comp.value * comp.weight);
              return (
                <div key={comp.label} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span>{comp.label}</span>
                    <span className="font-medium">{comp.value}/100 ({Math.round(comp.weight * 100)}%)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{comp.description}</p>
                  <p className="text-xs">Contributes: <span className="font-semibold">{points} pts</span></p>
                </div>
              );
            })}
            {hasRubberStampDiscount && (
              <p className="text-xs text-amber-600 dark:text-amber-400 pt-1 border-t">
                Note: Participation discounted due to &gt;{deliberationModifier === 0.70 ? '95' : deliberationModifier === 0.85 ? '90' : '85'}% uniform voting pattern.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ScoreBreakdown({ drep }: { drep: EnrichedDRep }) {
  return null;
}
