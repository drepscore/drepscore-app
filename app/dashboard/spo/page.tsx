import { Metadata } from 'next';
import { SpoDashboard } from '@/components/SpoDashboard';

export const metadata: Metadata = {
  title: 'SPO Dashboard | DRepScore',
  description: 'Manage your stake pool governance participation and track your voting record.',
};

export default function SpoDashboardPage() {
  return <SpoDashboard />;
}
