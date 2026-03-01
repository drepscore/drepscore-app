'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Lightbulb, Check, Copy, ChevronDown } from 'lucide-react';
import { type PillarStatus } from '@/utils/scoring';
import { useWallet } from '@/utils/wallet';
import { ScoreRing } from '@/components/ScoreRing';
import { PillarCard } from '@/components/PillarCard';
import { MethodologyAccordion } from '@/components/MethodologyAccordion';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

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
  const [copied, setCopied] = useState(false);
  const { isAuthenticated, ownDRepId } = useWallet();
  
  const isOwnProfile = isAuthenticated && ownDRepId === drep.drepId;
  
  const getPageUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return `https://drepscore.io/drep/${encodeURIComponent(drep.drepId)}`;
  };

  const getTweetText = () => {
    const name = drep.name || 'This DRep';
    if (isOwnProfile) {
      return `My DRepScore is ${drep.drepScore}/100! 🎯\n\nParticipation: ${drep.effectiveParticipation}% | Rationale: ${adjustedRationale}% | Reliability: ${drep.reliabilityScore}%\n\nSee my full report on @drepscore:`;
    }
    return `${name} scored ${drep.drepScore}/100 on @drepscore!\n\nCheck out their governance track record:`;
  };

  const handleShareOnX = () => {
    const url = getPageUrl();
    const text = getTweetText();
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    const url = getPageUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-transparent hover:border-border">
                {isOwnProfile ? 'Share My Score' : 'Share'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleShareOnX} className="gap-2 cursor-pointer">
                <XIcon className="h-3.5 w-3.5" />
                Share on X
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy link'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

        <div className="border-t pt-4">
          <MethodologyAccordion />
        </div>
      </CardContent>
    </Card>
  );
}
