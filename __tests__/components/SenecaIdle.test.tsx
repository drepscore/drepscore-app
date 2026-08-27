import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleContent } from '@/components/governada/panel/SenecaIdle';
import type { AnchoredCardDescriptor } from '@/components/globe/AnchoredCard';
import type { CinematicState, PrioritizedItem } from '@/types/cinematic';

let viewportClass: 'mobile' | 'desktop' = 'desktop';

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({ children, ...props }: { children: React.ReactNode }) =>
          React.createElement(tag, props, children),
    },
  ),
  useReducedMotion: () => false,
}));

vi.mock('@/components/governada/CompassSigil', () => ({
  CompassSigil: () => <span data-testid="compass-sigil" />,
}));

vi.mock('@/hooks/useViewportClass', () => ({
  useViewportClass: () => viewportClass,
}));

function item(state: CinematicState): PrioritizedItem {
  return {
    id: state,
    tier: 2,
    kind: 'informational',
    state,
    surfaced_at: '2026-05-07T00:00:00.000Z',
    payload: {},
  };
}

function anchoredCard(): AnchoredCardDescriptor {
  return {
    id: 'proposal-deadline',
    kind: 'civic',
    title: 'Voting deadline moved',
    body: 'The proposal now expires this epoch.',
    anchorNodeId: 'proposal_abc_0',
  };
}

function renderIdle(overrides: Partial<React.ComponentProps<typeof IdleContent>> = {}) {
  return render(
    <IdleContent
      panelRoute="hub"
      isAuthenticated
      quickActions={[]}
      anonOptions={[]}
      onQuickAction={vi.fn()}
      onAnonOption={vi.fn()}
      cinematicPrimary={item('civic_event_tier_0')}
      {...overrides}
    />,
  );
}

describe('Seneca IdleContent cinematic labels', () => {
  beforeEach(() => {
    viewportClass = 'desktop';
  });

  afterEach(() => {
    cleanup();
  });

  it('uses human copy instead of programmatic cinematic state names', () => {
    renderIdle();

    expect(screen.getByText('A constitutional moment')).toBeTruthy();
    expect(screen.queryByText(/civic event tier 0/i)).toBeNull();
  });

  it('drops headers for cinematic states whose body carries the context', () => {
    renderIdle({ cinematicPrimary: item('returning_quiet') });

    expect(screen.queryByText(/returning quiet/i)).toBeNull();
  });

  it('folds active anchored cards into secondary mentions when mobile Seneca is open', () => {
    viewportClass = 'mobile';

    renderIdle({
      cinematicPrimary: item('returning_quiet'),
      cinematicAnchoredCards: [anchoredCard()],
      panelOpen: true,
    });

    expect(screen.getByText('Still in view')).toBeTruthy();
    expect(screen.getByText('Voting deadline moved')).toBeTruthy();
    expect(screen.getByText('The proposal now expires this epoch.')).toBeTruthy();
  });

  it('does not fold anchored cards into the desktop idle panel', () => {
    viewportClass = 'desktop';

    renderIdle({
      cinematicPrimary: item('returning_quiet'),
      cinematicAnchoredCards: [anchoredCard()],
      panelOpen: true,
    });

    expect(screen.queryByText('Voting deadline moved')).toBeNull();
  });

  it('renders one approved newcomer pill set for anonymous first visits', () => {
    const onAnonOption = vi.fn();

    renderIdle({
      isAuthenticated: false,
      cinematicPrimary: item('first_visit_anonymous'),
      anonOptions: [
        {
          label: "What's being decided right now?",
          action: 'search',
          query: 'active proposals being voted on',
        },
      ],
      canRecordLifecycle: false,
      onAnonOption,
    });

    expect(
      screen.getByText(
        "Cardano has a government — and if you hold ADA, you have a say in it. This is a live map of who's making the decisions. Where do you want to start?",
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'What am I looking at?',
      'Why should I care?',
      "Who's making decisions?",
    ]);
    expect(screen.queryByText("What's being decided right now?")).toBeNull();
    expect(screen.queryByText('Got it')).toBeNull();
    expect(screen.queryByText('Dismiss')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: "Who's making decisions?" }));
    expect(onAnonOption).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Who's making decisions?",
        action: 'conversation',
        path: 'c',
        globeHint: 'participation',
      }),
    );
  });

  it('renders live anonymous governance highlights as tappable secondary content', () => {
    const onGovernanceHighlight = vi.fn();

    renderIdle({
      isAuthenticated: false,
      cinematicPrimary: item('first_visit_anonymous'),
      cinematicSecondary: [
        {
          ...item('returning_cold_start'),
          id: 'citizen-only-secondary',
        },
      ],
      governanceHighlights: [
        {
          id: 'open-proposals',
          kind: 'open_proposals',
          label: '3 proposals open now',
          body: 'Treasury, protocol, and governance updates are currently live.',
          href: '/governance/proposals',
        },
        {
          id: 'active-dreps',
          kind: 'active_representative',
          label: 'Most active this epoch: Ada Delegate',
          body: 'Last voted recently across active governance work.',
          globeCommand: { type: 'narrowTo', nodeIds: ['drep_drep1ada'], fly: false },
        },
      ],
      onGovernanceHighlight,
    });

    expect(screen.queryByText('Still in view')).toBeNull();
    expect(screen.getByText('Live governance')).toBeTruthy();
    expect(screen.getByText('3 proposals open now')).toBeTruthy();
    expect(screen.getByText('Most active this epoch: Ada Delegate')).toBeTruthy();
    expect(screen.queryByText('Your representative')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Most active this epoch: Ada Delegate/i }));
    expect(onGovernanceHighlight).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'active-dreps',
        globeCommand: { type: 'narrowTo', nodeIds: ['drep_drep1ada'], fly: false },
      }),
    );
  });
});
