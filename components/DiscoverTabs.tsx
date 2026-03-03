'use client';

import { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FeatureGate } from '@/components/FeatureGate';
import { PoolsDiscovery } from '@/components/PoolsDiscovery';
import { CommitteeDiscovery } from '@/components/CommitteeDiscovery';

interface DiscoverTabsProps {
  drepsContent: ReactNode;
}

export function DiscoverTabs({ drepsContent }: DiscoverTabsProps) {
  return (
    <FeatureGate flag="discover_tabs" fallback={<>{drepsContent}</>}>
      <Tabs defaultValue="dreps">
        <TabsList>
          <TabsTrigger value="dreps">DReps</TabsTrigger>
          <TabsTrigger value="pools">Pools</TabsTrigger>
          <TabsTrigger value="committee">Committee</TabsTrigger>
        </TabsList>
        <TabsContent value="dreps">{drepsContent}</TabsContent>
        <TabsContent value="pools">
          <PoolsDiscovery />
        </TabsContent>
        <TabsContent value="committee">
          <CommitteeDiscovery />
        </TabsContent>
      </Tabs>
    </FeatureGate>
  );
}
