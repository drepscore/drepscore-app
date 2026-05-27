/**
 * Self-heal class registry.
 *
 * Phase 2 ships slice-by-slice; each slice adds one entry below. Shipped:
 *   - `stale_sync`           (slice 0) - behavior-preserving extraction
 *                                       of the historical freshness-guard
 *                                       body.
 *   - `persistent_mismatch`  (slice 1) - auto-quarantines metrics with
 *                                       3+ consecutive mismatches spanning
 *                                       at least 30 min.
 *
 * Future slices append:
 *   - `vendor_degraded`     (slice 2)
 *   - `snapshot_gap`        (slice 3)
 *   - `schema_drift`        (slice 4)
 *
 * The mechanical guard in
 * `__tests__/lib/selfHeal/registry.test.ts` asserts every entry has a
 * matching `__tests__/lib/selfHeal/<name>.test.ts` so a class can't ship
 * without its test.
 */

import { persistentMismatchClass } from './classes/persistentMismatch';
import { staleSyncClass } from './classes/staleSync';
import type { SelfHealClass } from './types';

export const SELF_HEAL_REGISTRY: ReadonlyArray<SelfHealClass> = [
  staleSyncClass,
  persistentMismatchClass,
];

export function findSelfHealClass(name: string): SelfHealClass | undefined {
  return SELF_HEAL_REGISTRY.find((cls) => cls.className === name);
}
