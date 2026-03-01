import { Metadata } from 'next';
import { HomepageShell } from '@/components/HomepageShell';

export const metadata: Metadata = {
  title: 'Discover DReps — DRepScore',
  description: 'Find and compare Cardano DReps by score, participation, rationale quality, and alignment with your governance values.',
};

export default function DiscoverPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold">Discover DReps</h1>
        <p className="text-sm text-muted-foreground">
          Find Cardano governance representatives aligned with your values.
        </p>
      </div>
      <HomepageShell />
    </div>
  );
}
