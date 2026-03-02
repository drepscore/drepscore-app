'use client';

import { ConstellationHero } from '@/components/ConstellationHero';
import { HowItWorksV2 } from '@/components/HowItWorksV2';
import { DRepDiscoveryPreview } from '@/components/DRepDiscoveryPreview';

interface PreviewDRep {
  drepId: string;
  name: string | null;
  ticker: string | null;
  handle: string | null;
  drepScore: number;
  sizeTier: string;
  effectiveParticipation: number;
  alignmentTreasuryConservative?: number | null;
  alignmentTreasuryGrowth?: number | null;
  alignmentDecentralization?: number | null;
  alignmentSecurity?: number | null;
  alignmentInnovation?: number | null;
  alignmentTransparency?: number | null;
}

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
}

interface HomepageDualModeProps {
  pulseData: PulseData;
  topDReps: PreviewDRep[];
  ssrHolderData?: any;
  ssrWalletAddress?: string | null;
}

export function HomepageDualMode({ pulseData, topDReps, ssrHolderData, ssrWalletAddress }: HomepageDualModeProps) {
  return (
    <div>
      <ConstellationHero
        stats={{
          totalAdaGoverned: pulseData.totalAdaGoverned,
          activeProposals: pulseData.activeProposals,
          activeDReps: pulseData.activeDReps,
        }}
        ssrHolderData={ssrHolderData || undefined}
        ssrWalletAddress={ssrWalletAddress || undefined}
      />

      <div className="container mx-auto px-4 space-y-12 py-8">
        <HowItWorksV2 />
        <DRepDiscoveryPreview dreps={topDReps} />

        {/* Platform positioning footer */}
        <footer className="text-center py-8 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Governance intelligence for Cardano.
          </p>
          <a
            href="https://www.cardano.org/governance/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
          >
            New to Cardano?
          </a>
        </footer>
      </div>
    </div>
  );
}
