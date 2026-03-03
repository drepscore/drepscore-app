'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BodyVotes {
  yes: number;
  no: number;
  abstain: number;
  total?: number;
}

interface TriBodyVoteBarProps {
  drep?: BodyVotes;
  spo?: BodyVotes;
  cc?: BodyVotes;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CONFIG = {
  sm: { bar: 'h-1.5', text: 'text-[10px]' },
  md: { bar: 'h-2.5', text: 'text-xs' },
  lg: { bar: 'h-3.5', text: 'text-sm' },
} as const;

const BODY_COLORS = {
  primary: { label: 'text-primary', yes: 'bg-primary', no: 'bg-destructive', abstain: 'bg-muted-foreground/30' },
  cyan: { label: 'text-cyan-500', yes: 'bg-cyan-500', no: 'bg-destructive', abstain: 'bg-muted-foreground/30' },
  amber: { label: 'text-amber-500', yes: 'bg-amber-500', no: 'bg-destructive', abstain: 'bg-muted-foreground/30' },
} as const;

type BodyColor = keyof typeof BODY_COLORS;

export function TriBodyVoteBar({ drep, spo, cc, className, size = 'md' }: TriBodyVoteBarProps) {
  const { bar, text } = SIZE_CONFIG[size];

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('space-y-1.5', className)}>
        {drep && <VoteSegment label="DReps" data={drep} barHeight={bar} textSize={text} color="primary" />}
        {spo && <VoteSegment label="SPOs" data={spo} barHeight={bar} textSize={text} color="cyan" />}
        {cc && <VoteSegment label="CC" data={cc} barHeight={bar} textSize={text} color="amber" />}
      </div>
    </TooltipProvider>
  );
}

function VoteSegment({ label, data, barHeight, textSize, color }: {
  label: string;
  data: BodyVotes;
  barHeight: string;
  textSize: string;
  color: BodyColor;
}) {
  const total = data.total || (data.yes + data.no + data.abstain) || 1;
  const yesPct = Math.round((data.yes / total) * 100);
  const noPct = Math.round((data.no / total) * 100);
  const abstainPct = 100 - yesPct - noPct;

  const colors = BODY_COLORS[color];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <span className={cn('w-12 text-right font-medium shrink-0', textSize, colors.label)}>
            {label}
          </span>
          <div className={cn('flex-1 flex rounded-full overflow-hidden', barHeight)}>
            {yesPct > 0 && <div className={cn(colors.yes)} style={{ width: `${yesPct}%` }} />}
            {noPct > 0 && <div className={cn(colors.no)} style={{ width: `${noPct}%` }} />}
            {abstainPct > 0 && <div className={cn(colors.abstain)} style={{ width: `${abstainPct}%` }} />}
          </div>
          <span className={cn('w-10 text-right tabular-nums text-muted-foreground', textSize)}>
            {yesPct}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p>{label}: {data.yes} Yes · {data.no} No · {data.abstain} Abstain</p>
      </TooltipContent>
    </Tooltip>
  );
}
