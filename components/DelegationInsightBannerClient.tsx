'use client';

import dynamic from 'next/dynamic';

const DelegationInsightBanner = dynamic(
  () => import('@/components/DelegationInsightBanner').then(mod => ({ default: mod.DelegationInsightBanner })),
  { ssr: false }
);

export function DelegationInsightBannerClient() {
  return <DelegationInsightBanner />;
}
