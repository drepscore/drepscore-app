/**
 * Homepage
 * Features hero section with value selector and DRep table
 * DRep Score (0-100) is the primary sorting and display metric
 * Data is fetched client-side via API route to avoid 128KB server prop limit
 */

import { HomepageShell } from '@/components/HomepageShell';
import { HeroSection } from '@/components/HeroSection';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <HeroSection />
      <HomepageShell />
    </div>
  );
}
