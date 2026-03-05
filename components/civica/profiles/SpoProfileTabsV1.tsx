'use client';

import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { Vote, BarChart3, TrendingUp, Network } from 'lucide-react';
import type { ReactNode } from 'react';

interface SpoProfileTabsV1Props {
  poolId?: string;
  votingRecordContent: ReactNode;
  scoreAnalysisContent: ReactNode;
  trajectoryContent: ReactNode;
  interBodyContent: ReactNode;
}

export function SpoProfileTabsV1({
  poolId,
  votingRecordContent,
  scoreAnalysisContent,
  trajectoryContent,
  interBodyContent,
}: SpoProfileTabsV1Props) {
  const tabs: TabDefinition[] = [
    { id: 'voting', label: 'Voting Record', icon: Vote, content: votingRecordContent },
    { id: 'score', label: 'Score Analysis', icon: BarChart3, content: scoreAnalysisContent },
    { id: 'trajectory', label: 'Trajectory', icon: TrendingUp, content: trajectoryContent },
    { id: 'inter-body', label: 'Inter-Body', icon: Network, content: interBodyContent },
  ];

  return (
    <AnimatedTabs
      tabs={tabs}
      defaultTab="voting"
      stickyOffset={64}
      trackingContext={poolId ? { poolId } : undefined}
    />
  );
}
