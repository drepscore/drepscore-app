/**
 * Self-Heal Playbook v2 — core types.
 *
 * The walker iterates a registry of recovery classes; each class is a small,
 * testable unit that detects a known failure signal and runs a bounded
 * mitigation. Every fire records a row in `self_heal_actions` for forensic
 * replay and `/admin/systems/self-heal` history.
 *
 * Strategy authority: governada-brain/strategy/sync-pipeline-architecture.md
 * § Phase 2 / § 4.7.
 */

export type SelfHealClassName =
  | 'stale_sync'
  | 'vendor_degraded'
  | 'schema_drift'
  | 'snapshot_gap'
  | 'persistent_mismatch';

/**
 * Minimal Inngest step interface the walker depends on. Lets test code pass
 * a plain object without pulling in the full Inngest types.
 */
export interface SelfHealStep {
  run<T>(id: string, fn: () => Promise<T> | T): Promise<T>;
}

export interface SelfHealRecordInput {
  signal: Record<string, unknown>;
  action: string;
  success: boolean;
  escalated?: boolean;
  detail?: Record<string, unknown>;
  startedAt?: string;
}

export interface SelfHealRecorder {
  record(input: SelfHealRecordInput): Promise<void>;
}

export interface SelfHealContext {
  step: SelfHealStep;
  recorder: SelfHealRecorder;
}

export interface SelfHealRunResult {
  className: SelfHealClassName;
  actions: number;
  details: string[];
  /** Set if the class threw; the walker still records the failure. */
  error?: string;
}

export interface SelfHealClass {
  readonly className: SelfHealClassName;
  run(ctx: SelfHealContext): Promise<SelfHealRunResult>;
}
