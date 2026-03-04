import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonalGovernanceCard } from '@/components/PersonalGovernanceCard';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('PersonalGovernanceCard', () => {
  it('renders delegated variant', () => {
    const { container } = render(
      <PersonalGovernanceCard
        segment="delegated"
        delegated={{
          drepName: 'Test DRep',
          drepId: 'drep1abc',
          drepScore: 82,
          scoreTrend: 3,
          representationMatch: 78,
          openProposals: 5,
          epochCountdown: '3d 12h',
          dominant: 'transparency',
        }}
      />,
    );
    expect(container.textContent).toContain('Test DRep');
  });

  it('renders undelegated variant', () => {
    const { container } = render(
      <PersonalGovernanceCard
        segment="undelegated"
        undelegated={{
          totalAdaGoverned: '45B',
        }}
      />,
    );
    expect(container.textContent).toContain('45B');
  });

  it('renders drep variant', () => {
    const { container } = render(
      <PersonalGovernanceCard
        segment="drep"
        drep={{
          drepId: 'drep1xyz',
          drepScore: 91,
          scoreTrend: -1,
          rank: 5,
          totalRanked: 200,
          delegatorCount: 150,
          pendingProposals: 3,
          dominant: 'decentralization',
        }}
      />,
    );
    expect(container.textContent).toContain('91');
  });
});
