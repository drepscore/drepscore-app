import { getAllProposalsWithVoteSummary } from '@/lib/data';
import { ProposalsListClient } from '@/components/ProposalsListClient';

export const revalidate = 900; // 15 min cache

export default async function ProposalsPage() {
  const proposals = await getAllProposalsWithVoteSummary();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-bold">Governance Proposals</h1>
        <p className="text-muted-foreground">
          All Cardano governance proposals with DRep vote breakdowns. Click any proposal to see how DReps voted.
        </p>
      </div>
      <ProposalsListClient proposals={proposals} />
    </div>
  );
}
