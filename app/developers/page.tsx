import type { Metadata } from 'next';
import { DeveloperPage } from '@/components/DeveloperPage';

export const metadata: Metadata = {
  title: 'Developers — Civica API',
  description:
    'Build on governance intelligence. Interactive API explorer, embeddable widgets, and documentation for the Civica v1 API.',
  openGraph: {
    title: 'Civica Developer Platform',
    description:
      'Build on governance intelligence. API explorer, embeddable widgets, and documentation.',
  },
};

export default function DevelopersPage() {
  return <DeveloperPage />;
}
