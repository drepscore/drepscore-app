import type { Metadata } from 'next';
import { TreasuryDashboard } from '@/components/TreasuryDashboard';

export const metadata: Metadata = {
  title: 'Treasury Intelligence — DRepScore',
  description: 'Real-time Cardano treasury health, runway projections, spending accountability, and What-If simulation.',
  openGraph: {
    title: 'Cardano Treasury Intelligence — DRepScore',
    description: 'Track Cardano treasury health, spending trends, and runway projections. The first treasury accountability dashboard in crypto.',
  },
};

export default function TreasuryPage() {
  return <TreasuryDashboard />;
}
