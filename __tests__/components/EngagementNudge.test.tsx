import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { convertMock, dismissMock, posthogCaptureMock } = vi.hoisted(() => ({
  convertMock: vi.fn(),
  dismissMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
}));

vi.mock('lucide-react', () => ({
  Wallet: (props: Record<string, unknown>) => <span data-testid="wallet-icon" {...props} />,
  Shield: (props: Record<string, unknown>) => <span data-testid="shield-icon" {...props} />,
  TrendingUp: (props: Record<string, unknown>) => <span data-testid="trending-icon" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="x-icon" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/hooks/useEngagementNudge', () => ({
  useEngagementNudge: () => ({
    shouldShow: true,
    variant: 1,
    dismiss: dismissMock,
    convert: convertMock,
  }),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: posthogCaptureMock },
}));

const { EngagementNudge } = await import('@/components/discovery/EngagementNudge');

describe('EngagementNudge', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the wallet nudge lower-left with a defensive z-index floor', () => {
    const { container } = render(<EngagementNudge />);

    expect(screen.getByText('Your ADA, your voice')).toBeTruthy();
    const floatingCard = container.querySelector('.fixed');
    expect(floatingCard?.className).toContain('left-4');
    expect(floatingCard?.className).not.toContain('right-4');
    expect(floatingCard?.className).toContain('z-50');
  });

  it('records the CTA click and delegates wallet opening to the hook', () => {
    render(<EngagementNudge />);

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

    expect(convertMock).toHaveBeenCalledTimes(1);
    expect(posthogCaptureMock).toHaveBeenCalledWith('engagement_nudge_converted', {
      variant: 1,
      cta: 'Get Started',
    });
  });
});
