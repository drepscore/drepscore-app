import { getAllProposalsWithVoteSummary } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { ProposalsPageClient } from '@/components/ProposalsPageClient';
import { PageViewTracker } from '@/components/PageViewTracker';

export const revalidate = 900; // 15 min cache

export default async function ProposalsPage() {
  const proposals = await getAllProposalsWithVoteSummary();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-bold">Governance Proposals</h1>
        <p className="text-muted-foreground">
          All Cardano governance proposals with DRep vote breakdowns. Click any proposal to see how DReps voted.
        </p>
      </div>
      <PageViewTracker event="proposals_page_viewed" />
      <ProposalsPageClient proposals={proposals} currentEpoch={currentEpoch} />
    </div>
  );
}
