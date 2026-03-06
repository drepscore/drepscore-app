import type { Metadata } from 'next';
import { QuickMatchFlow } from '@/components/civica/match/QuickMatchFlow';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quick Match — Find Your DRep or SPO — Civica',
  description:
    'Answer 3 questions about your governance values and find the Cardano DRep or Stake Pool Operator who represents you best. No wallet required.',
};

export default function MatchPage() {
  return <QuickMatchFlow />;
}
