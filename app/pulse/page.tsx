import { Metadata } from 'next';
import { PulseHub } from '@/components/PulseHub';

export const metadata: Metadata = {
  title: 'Governance Pulse | DRepScore',
  description: 'Real-time governance intelligence for Cardano',
};

export const dynamic = 'force-dynamic';

export default function PulsePage() {
  return <PulseHub />;
}
