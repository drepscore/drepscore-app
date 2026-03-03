import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { EpochTimeline } from '@/components/EpochTimeline';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Epoch Recaps | DRepScore',
  description: 'Browse the history of Cardano governance epoch by epoch',
};

export const dynamic = 'force-dynamic';

export default async function PulseHistoryPage() {
  const enabled = await getFeatureFlag('epoch_recaps', false);

  if (!enabled) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/pulse"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Pulse
        </Link>
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Coming soon</h2>
          <p className="text-muted-foreground text-sm">
            Epoch recaps are under development.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const { data: recaps } = await supabase
    .from('epoch_recaps')
    .select('*')
    .order('epoch', { ascending: false })
    .limit(20);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/pulse"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Pulse
      </Link>

      <h1 className="text-2xl font-bold mb-2">Epoch Recaps</h1>
      <p className="text-muted-foreground mb-8">
        Browse the history of Cardano governance, epoch by epoch.
      </p>

      <EpochTimeline initialRecaps={recaps ?? []} />
    </div>
  );
}
