import type { Metadata } from 'next';
import { GovernanceDashboard } from '@/components/GovernanceDashboard';
import { GovernanceCalendar } from '@/components/GovernanceCalendar';

export const metadata: Metadata = {
  title: 'My Governance — DRepScore',
  description: 'Track your delegation health, representation score, and active governance proposals.',
};

export default function GovernancePage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <GovernanceDashboard />
      <GovernanceCalendar />
    </div>
  );
}
