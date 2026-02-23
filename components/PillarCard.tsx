'use client';

import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { type PillarStatus } from '@/utils/scoring';

interface PillarCardProps {
  label: string;
  value: number;
  weight: string;
  status: PillarStatus;
  hint: string;
}

const STATUS_CONFIG: Record<PillarStatus, {
  icon: typeof CheckCircle2;
  badgeLabel: string;
  badgeClass: string;
  iconClass: string;
}> = {
  strong: {
    icon: CheckCircle2,
    badgeLabel: 'Strong',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  'needs-work': {
    icon: AlertTriangle,
    badgeLabel: 'Needs Work',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  low: {
    icon: AlertCircle,
    badgeLabel: 'Low',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
  },
};

export function PillarCard({ label, value, weight, status, hint }: PillarCardProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.iconClass}`} />
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${config.badgeClass}`}>
            {config.badgeLabel}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {value}% <span className="text-xs">({weight})</span>
        </span>
      </div>
      <Progress value={value} className="h-2" />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
