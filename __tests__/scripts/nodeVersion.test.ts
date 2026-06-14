import { describe, expect, it } from 'vitest';

import {
  compareVersionParts,
  isNodeVersionSupported,
  parseVersionParts,
} from '@/scripts/lib/node-version.mjs';

describe('Node version helpers', () => {
  it('parses v-prefixed semantic versions into numeric parts', () => {
    expect(parseVersionParts('v24.15.0')).toEqual([24, 15, 0]);
    expect(parseVersionParts('24.18.3')).toEqual([24, 18, 3]);
  });

  it('compares semantic version parts', () => {
    expect(compareVersionParts([24, 15, 0], [24, 15, 0])).toBe(0);
    expect(compareVersionParts([24, 16, 0], [24, 15, 0])).toBe(1);
    expect(compareVersionParts([24, 14, 9], [24, 15, 0])).toBe(-1);
  });

  it('accepts Node 24.15 through Node 24 and rejects older 24.x and Node 25', () => {
    expect(isNodeVersionSupported('24.15.0')).toBe(true);
    expect(isNodeVersionSupported('24.99.0')).toBe(true);
    expect(isNodeVersionSupported('24.14.0')).toBe(false);
    expect(isNodeVersionSupported('25.0.0')).toBe(false);
  });
});
