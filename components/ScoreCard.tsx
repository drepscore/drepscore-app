'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Share2, Check } from 'lucide-react';
import { getDRepScoreBadgeClass, type PillarStatus } from '@/utils/scoring';
import { ScoreRing } from '@/components/ScoreRing';
import { PillarCard } from '@/components/PillarCard';

interface ScoreCardProps {
  drep: {
    drepId: string;
    name: string | null;
    drepScore: number;
    effectiveParticipation: number;
    reliabilityScore: number;
    profileCompleteness: number;
  };
  adjustedRationale: number;
  pillars: { value: number; label: string; weight: string; maxPoints: number }[];
  pillarStatuses: PillarStatus[];
  quickWin: string | null;
  percentile: number;
  participationHint: string;
  rationaleHint: string;
  reliabilityHint: string;
  profileHint: string;
}

function getCardGradient(score: number): string {
  if (score >= 80) return 'bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20 dark:to-transparent';
  if (score >= 60) return 'bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20 dark:to-transparent';
  return 'bg-gradient-to-br from-red-50/30 to-transparent dark:from-red-950/15 dark:to-transparent';
}

export function ScoreCard({
  drep, adjustedRationale, pillars, pillarStatuses, quickWin,
  percentile, participationHint, rationaleHint, reliabilityHint, profileHint,
}: ScoreCardProps) {
  const [shared, setShared] = useState(false);

  const handleShare = () => {
    const name = drep.name || 'This DRep';
    const text = [
      `${name} scored ${drep.drepScore}/100 on $drepscore`,
      `Participation: ${drep.effectiveParticipation}% | Rationale: ${adjustedRationale}% | Reliability: ${drep.reliabilityScore}% | Profile: ${drep.profileCompleteness}%`,
      `See the full report: https://drepscore-app.vercel.app/drep/${encodeURIComponent(drep.drepId)}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    });
  };

  const hints = [participationHint, rationaleHint, reliabilityHint, profileHint];

  return (
    <Card className={getCardGradient(drep.drepScore)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>DRep Score</CardTitle>
            <div className="flex items-center gap-1" title={`${pillarStatuses.filter(s => s === 'strong').length} of 4 pillars at Strong`}>
              {pillarStatuses.map((s, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${
                    s === 'strong' ? 'bg-green-500' : s === 'needs-work' ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-transparent hover:border-border"
          >
            {shared ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Share2 className="h-3.5 w-3.5" />}
            {shared ? 'Copied!' : 'Share'}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score ring + percentile */}
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={drep.drepScore} />
          {percentile > 0 && (
            <span className="text-xs text-muted-foreground">
              Higher than {percentile}% of DReps
            </span>
          )}
        </div>

        {/* Score range bar */}
        <div className="space-y-1">
          <div className="relative flex h-2 rounded-full overflow-hidden">
            <div className="flex-[60] bg-red-200 dark:bg-red-900/40" />
            <div className="flex-[20] bg-amber-200 dark:bg-amber-900/40" />
            <div className="flex-[20] bg-green-200 dark:bg-green-900/40" />
            {/* Position marker */}
            <div
              className="absolute top-[-3px] h-[14px] w-[3px] rounded-full bg-foreground"
              style={{ left: `${Math.min(99, Math.max(1, drep.drepScore))}%` }}
            />
          </div>
          <div className="flex text-[10px] text-muted-foreground">
            <span className="flex-[60]">Low</span>
            <span className="flex-[20] text-center">Good</span>
            <span className="flex-[20] text-right">Strong</span>
          </div>
        </div>

        {/* Biggest opportunity callout */}
        {quickWin && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
              Biggest opportunity: {quickWin}
            </p>
          </div>
        )}

        {/* Pillar cards */}
        {pillars.map((p, i) => (
          <PillarCard
            key={p.label}
            label={p.label}
            value={p.value}
            weight={p.weight}
            maxPoints={p.maxPoints}
            status={pillarStatuses[i]}
            hint={hints[i]}
          />
        ))}
      </CardContent>
    </Card>
  );
}
