import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEngagementNudge } from '@/hooks/useEngagementNudge';

const { usePathnameMock, useSegmentMock, useViewportClassMock, senecaStoreState } = vi.hoisted(
  () => ({
    usePathnameMock: vi.fn(),
    useSegmentMock: vi.fn(),
    useViewportClassMock: vi.fn(),
    senecaStoreState: { isOpen: false },
  }),
);

vi.mock('next/navigation', () => ({
  usePathname: usePathnameMock,
}));

vi.mock('@/components/providers/SegmentProvider', () => ({
  useSegment: useSegmentMock,
}));

vi.mock('@/hooks/useViewportClass', () => ({
  useViewportClass: useViewportClassMock,
}));

vi.mock('@/stores/senecaThreadStore', () => ({
  useSenecaThreadStore: (selector: (state: { isOpen: boolean }) => unknown) =>
    selector(senecaStoreState),
}));

function seedTriggeredDiscoveryState() {
  localStorage.setItem(
    'governada_discovery',
    JSON.stringify({
      firstPageViewAt: Date.now() - 60_000,
      pageViewCount: 3,
      nudgeDismissedAt: null,
      nudgeShownCount: 0,
      nudgeConvertedAt: null,
    }),
  );
}

describe('useEngagementNudge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    usePathnameMock.mockReturnValue('/governance/health/methodology');
    useSegmentMock.mockReturnValue({ segment: 'anonymous' });
    useViewportClassMock.mockReturnValue('desktop');
    senecaStoreState.isOpen = false;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows on deeper anonymous pages after the engagement threshold is met', async () => {
    seedTriggeredDiscoveryState();

    const { result } = renderHook(() => useEngagementNudge());

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.shouldShow).toBe(true);
  });

  it('stays hidden on the anonymous homepage even when the engagement threshold is met', async () => {
    usePathnameMock.mockReturnValue('/');
    seedTriggeredDiscoveryState();

    const { result } = renderHook(() => useEngagementNudge());

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.shouldShow).toBe(false);
  });

  it('suppresses the nudge on mobile while the Seneca panel is open', async () => {
    useViewportClassMock.mockReturnValue('mobile');
    senecaStoreState.isOpen = true;
    seedTriggeredDiscoveryState();

    const { result } = renderHook(() => useEngagementNudge());

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.shouldShow).toBe(false);
  });

  it('dispatches the wallet-connect event when converting', () => {
    const listener = vi.fn();
    window.addEventListener('openWalletConnect', listener);

    const { result } = renderHook(() => useEngagementNudge());

    act(() => {
      result.current.convert();
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('openWalletConnect', listener);
  });
});
