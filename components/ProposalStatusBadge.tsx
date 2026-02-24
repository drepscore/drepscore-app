import { Badge } from '@/components/ui/badge';
import {
  getProposalStatus,
  getProposalPriority,
  STATUS_STYLES,
  PRIORITY_STYLES,
  TYPE_EXPLAINERS,
  type ProposalStatus,
  type ProposalPriority,
} from '@/utils/proposalPriority';

interface StatusBadgeProps {
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
}

export function ProposalStatusBadge({ ratifiedEpoch, enactedEpoch, droppedEpoch, expiredEpoch }: StatusBadgeProps) {
  const status = getProposalStatus({ ratifiedEpoch, enactedEpoch, droppedEpoch, expiredEpoch });
  const config = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={`text-[10px] ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ proposalType }: { proposalType: string }) {
  const priority = getProposalPriority(proposalType);
  if (priority === 'standard') return null;
  const config = PRIORITY_STYLES[priority];
  return (
    <Badge variant="outline" className={`text-[10px] ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function DeadlineBadge({ expirationEpoch, currentEpoch }: { expirationEpoch: number | null; currentEpoch: number }) {
  if (expirationEpoch == null) return null;
  const remaining = Math.max(0, expirationEpoch - currentEpoch);
  if (remaining === 0) return null;

  const urgentClass = remaining <= 1
    ? 'text-red-600 dark:text-red-400'
    : remaining <= 2
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-muted-foreground';

  return (
    <span className={`text-[10px] tabular-nums ${urgentClass}`}>
      {remaining} epoch{remaining !== 1 ? 's' : ''} left
    </span>
  );
}

export function TypeExplainerTooltip({ proposalType }: { proposalType: string }) {
  const explainer = TYPE_EXPLAINERS[proposalType];
  if (!explainer) return null;

  return (
    <span className="relative group/tip inline-flex items-center">
      <span className="cursor-help text-muted-foreground hover:text-foreground transition-colors text-xs">ⓘ</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-md bg-popover border shadow-md text-xs text-popover-foreground w-64 opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-50">
        {explainer}
      </span>
    </span>
  );
}

export { getProposalStatus, getProposalPriority, STATUS_STYLES, PRIORITY_STYLES };
export type { ProposalStatus, ProposalPriority };
