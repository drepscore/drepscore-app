'use client';

import Link from 'next/link';
import { Vote, AlertCircle, TrendingDown, Clock, Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Action, ActionType } from '@/lib/actionFeed';

const TYPE_ICON: Record<ActionType, React.FC<{ className?: string }>> = {
  vote_required: Vote,
  delegation_stale: AlertCircle,
  score_dropped: TrendingDown,
  proposal_expiring: Clock,
  tier_approaching: Star,
};

const TYPE_COLOR: Record<ActionType, string> = {
  vote_required: 'text-primary border-primary/30 bg-primary/5',
  delegation_stale: 'text-rose-400 border-rose-900/40 bg-rose-950/10',
  score_dropped: 'text-amber-400 border-amber-900/40 bg-amber-950/10',
  proposal_expiring: 'text-amber-400 border-amber-900/40 bg-amber-950/10',
  tier_approaching: 'text-violet-400 border-violet-900/40 bg-violet-950/10',
};

const TYPE_ICON_COLOR: Record<ActionType, string> = {
  vote_required: 'text-primary',
  delegation_stale: 'text-rose-400',
  score_dropped: 'text-amber-400',
  proposal_expiring: 'text-amber-400',
  tier_approaching: 'text-violet-400',
};

export function ActionFeed({ actions }: { actions: Action[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">All caught up</p>
        <p className="text-xs text-muted-foreground">No actions required right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {actions.map((action) => {
        const Icon = TYPE_ICON[action.type];
        const colorClass = TYPE_COLOR[action.type];
        const iconColor = TYPE_ICON_COLOR[action.type];

        const inner = (
          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 transition-colors',
              colorClass,
              action.href && 'cursor-pointer hover:brightness-110',
            )}
          >
            <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{action.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            </div>
            {action.href && action.cta && (
              <div className="flex items-center gap-0.5 shrink-0 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                {action.cta}
                <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </div>
        );

        return action.href ? (
          <Link key={action.id} href={action.href} className="block group">
            {inner}
          </Link>
        ) : (
          <div key={action.id}>{inner}</div>
        );
      })}
    </div>
  );
}
