'use client';

import { useEffect, useState } from 'react';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Award,
  Shield,
  Users,
  Star,
  Target,
  FileText,
  CheckCircle2,
  Lock,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Shield, Users, Star, Target, FileText, CheckCircle2,
};

interface Milestone {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  achieved: boolean;
  achievedAt: string | null;
}

interface MilestoneBadgesProps {
  drepId: string;
  compact?: boolean;
}

export function MilestoneBadges({ drepId, compact = false }: MilestoneBadgesProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!drepId) return;
    // Check for new milestones first, then fetch
    fetch('/api/dashboard/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drepId }),
    })
      .then(() => fetch(`/api/dashboard/milestones?drepId=${encodeURIComponent(drepId)}`))
      .then(r => r.json())
      .then(d => {
        if (d.milestones) setMilestones(d.milestones);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [drepId]);

  useEffect(() => {
    const achieved = milestones.filter(m => m.achieved);
    if (achieved.length > 0) {
      posthog.capture('milestone_achieved', { drepId, count: achieved.length, keys: achieved.map(m => m.key) });
    }
  }, [milestones, drepId]);

  if (loading) {
    return compact ? null : (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const achieved = milestones.filter(m => m.achieved);
  const unachieved = milestones.filter(m => !m.achieved);

  if (compact) {
    if (achieved.length === 0) return null;
    return (
      <TooltipProvider>
        <div className="flex flex-wrap gap-1.5">
          {achieved.map(m => {
            const Icon = ICON_MAP[m.icon] || Award;
            return (
              <Tooltip key={m.key}>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Icon className="h-3 w-3" />
                    {m.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{m.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4" />
          Achievements
          <Badge variant="secondary" className="text-[10px]">{achieved.length}/{milestones.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-3 gap-2">
            {achieved.map(m => {
              const Icon = ICON_MAP[m.icon] || Award;
              return (
                <Tooltip key={m.key}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-primary/5 border border-primary/20 text-center">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-[10px] font-medium leading-tight">{m.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{m.description}</p>
                    {m.achievedAt && <p className="text-[10px] text-muted-foreground mt-0.5">Achieved {new Date(m.achievedAt).toLocaleDateString()}</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {unachieved.slice(0, 6 - achieved.length).map(m => {
              const Icon = ICON_MAP[m.icon] || Award;
              return (
                <Tooltip key={m.key}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/40 text-center opacity-40">
                      <Lock className="h-5 w-5" />
                      <span className="text-[10px] font-medium leading-tight">{m.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{m.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
