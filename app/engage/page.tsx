import type { Metadata } from 'next';
import { blockTimeToEpoch } from '@/lib/koios';
import { EngageClient } from './EngageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Civic Engagement — Civica',
  description:
    'Shape Cardano governance. Vote on priorities, participate in citizen assemblies, and make your voice heard.',
};

export default async function EngagePage() {
  // Server component -- Date.now() is fine here (runs once per request)
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const currentEpoch = blockTimeToEpoch(Math.floor(now / 1000));

  return <EngageClient epoch={currentEpoch} />;
}
