import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runSelfHealWalker } from '@/lib/selfHeal/walker';
import type {
  SelfHealClass,
  SelfHealRecordInput,
  SelfHealRecorder,
  SelfHealStep,
} from '@/lib/selfHeal/types';

const passthroughStep: SelfHealStep = {
  async run(_id, fn) {
    return fn();
  },
};

function recordingRecorder(records: SelfHealRecordInput[]): SelfHealRecorder {
  return {
    async record(input: SelfHealRecordInput) {
      records.push(input);
    },
  };
}

function buildClass(
  name: 'stale_sync' | 'vendor_degraded',
  behavior: 'ok' | 'throw',
): SelfHealClass {
  return {
    className: name,
    async run() {
      if (behavior === 'throw') throw new Error(`${name} boom`);
      return { className: name, actions: 1, details: [`${name}-detail`] };
    },
  };
}

describe('runSelfHealWalker', () => {
  it('runs every class in the registry and returns one result per class', async () => {
    const records: SelfHealRecordInput[] = [];
    const registry = [buildClass('stale_sync', 'ok'), buildClass('vendor_degraded', 'ok')];

    const results = await runSelfHealWalker({
      step: passthroughStep,
      registry,
      recorderFor: () => recordingRecorder(records),
    });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.className)).toEqual(['stale_sync', 'vendor_degraded']);
    expect(results.every((r) => r.actions === 1)).toBe(true);
    expect(results.every((r) => !r.error)).toBe(true);
  });

  it('isolates a throwing class — other classes still run', async () => {
    const registry = [buildClass('stale_sync', 'throw'), buildClass('vendor_degraded', 'ok')];

    const results = await runSelfHealWalker({
      step: passthroughStep,
      registry,
      recorderFor: () => ({ record: async () => undefined }),
    });

    expect(results).toHaveLength(2);

    const stale = results.find((r) => r.className === 'stale_sync');
    expect(stale?.error).toMatch(/stale_sync boom/);
    expect(stale?.actions).toBe(0);

    const vendor = results.find((r) => r.className === 'vendor_degraded');
    expect(vendor?.error).toBeUndefined();
    expect(vendor?.actions).toBe(1);
  });

  it('honors the `only` filter', async () => {
    const registry = [buildClass('stale_sync', 'ok'), buildClass('vendor_degraded', 'ok')];

    const results = await runSelfHealWalker({
      step: passthroughStep,
      registry,
      only: ['vendor_degraded'],
      recorderFor: () => ({ record: async () => undefined }),
    });

    expect(results).toHaveLength(1);
    expect(results[0].className).toBe('vendor_degraded');
  });
});
