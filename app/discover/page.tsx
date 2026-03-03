import { Metadata } from 'next';
import { getAllDReps } from '@/lib/data';
import { HomepageShell } from '@/components/HomepageShell';
import { PageViewTracker } from '@/components/PageViewTracker';
import { DiscoverTabs } from '@/components/DiscoverTabs';

export const metadata: Metadata = {
  title: 'Discover Governance — DRepScore',
  description:
    'Find and compare Cardano DReps, governance-active stake pools, and Constitutional Committee members.',
};

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  const { dreps, allDReps, totalAvailable } = await getAllDReps();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Discover Governance</h1>
        <p className="text-sm text-muted-foreground">
          Explore DReps, stake pools, and Constitutional Committee members participating in Cardano governance.
        </p>
      </div>
      <PageViewTracker event="discover_page_viewed" />
      <DiscoverTabs
        drepsContent={
          <HomepageShell
            initialDReps={dreps}
            initialAllDReps={allDReps}
            initialTotalAvailable={totalAvailable}
          />
        }
      />
    </div>
  );
}
