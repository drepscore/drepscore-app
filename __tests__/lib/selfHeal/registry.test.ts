import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SELF_HEAL_REGISTRY, findSelfHealClass } from '@/lib/selfHeal/registry';
import type { SelfHealClassName } from '@/lib/selfHeal/types';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const KNOWN_CLASS_NAMES: ReadonlyArray<SelfHealClassName> = [
  'stale_sync',
  'vendor_degraded',
  'schema_drift',
  'snapshot_gap',
  'persistent_mismatch',
];

describe('self-heal registry', () => {
  it('has at least one class registered', () => {
    expect(SELF_HEAL_REGISTRY.length).toBeGreaterThan(0);
  });

  it('every registered className matches the SelfHealClassName union', () => {
    const known = new Set<string>(KNOWN_CLASS_NAMES);
    for (const cls of SELF_HEAL_REGISTRY) {
      expect(known.has(cls.className)).toBe(true);
    }
  });

  it('no duplicate className across the registry', () => {
    const names = SELF_HEAL_REGISTRY.map((cls) => cls.className);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every registered class has a matching __tests__/lib/selfHeal/<name>.test.ts file', () => {
    // Mechanical guard: forces every new slice to ship its own test file.
    for (const cls of SELF_HEAL_REGISTRY) {
      const camelName = cls.className.replace(/_([a-z])/gu, (_, c) => c.toUpperCase());
      const testPath = join(REPO_ROOT, '__tests__', 'lib', 'selfHeal', `${camelName}.test.ts`);
      expect(
        existsSync(testPath),
        `Missing __tests__/lib/selfHeal/${camelName}.test.ts for registered class ${cls.className}`,
      ).toBe(true);
    }
  });

  it('findSelfHealClass returns the registered entry by name', () => {
    for (const cls of SELF_HEAL_REGISTRY) {
      expect(findSelfHealClass(cls.className)).toBe(cls);
    }
  });

  it('findSelfHealClass returns undefined for unknown names', () => {
    expect(findSelfHealClass('not_a_real_class')).toBeUndefined();
  });
});
