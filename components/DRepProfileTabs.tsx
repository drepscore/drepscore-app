'use client';

import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Vote, Landmark, User } from 'lucide-react';
import type { ReactNode } from 'react';

interface DRepProfileTabsProps {
  scoreAnalysisContent: ReactNode;
  votingRecordContent: ReactNode;
  treasuryPhilosophyContent: ReactNode;
  aboutContent: ReactNode;
}

function TabSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-[200px] w-full" />
      <Skeleton className="h-[160px] w-full" />
    </div>
  );
}

export function DRepProfileTabs({
  scoreAnalysisContent,
  votingRecordContent,
  treasuryPhilosophyContent,
  aboutContent,
}: DRepProfileTabsProps) {
  const tabs: TabDefinition[] = [
    {
      id: 'score',
      label: 'Score Analysis',
      icon: BarChart3,
      content: scoreAnalysisContent,
    },
    {
      id: 'votes',
      label: 'Voting Record',
      icon: Vote,
      content: votingRecordContent,
    },
    {
      id: 'treasury',
      label: 'Treasury & Philosophy',
      icon: Landmark,
      content: treasuryPhilosophyContent,
    },
    {
      id: 'about',
      label: 'About',
      icon: User,
      content: aboutContent,
    },
  ];

  return <AnimatedTabs tabs={tabs} defaultTab="score" stickyOffset={64} />;
}
