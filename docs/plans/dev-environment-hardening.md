---
status: active
created: 2026-06-14
updated: 2026-06-14
pr:
---

# Dev Environment Hardening

Lean plan note — a transient scoping artifact, not a contract and not evergreen documentation.

## Spec Link

Path or URL: user request in Codex thread, 2026-06-14.

## Files Read

- `README.md`
- `package.json`
- `.nvmrc`
- `.node-version`
- `.claude/commands/plan.md`
- `/Users/tim/dev/governada/governada-brain/templates/plan.md`
- `scripts/env-doctor.mjs`
- `scripts/env-run.mjs`
- `scripts/op-agent-doctor.mjs`
- `scripts/session-doctor.js`
- `scripts/peer-review.mjs`
- `scripts/new-worktree.mjs`
- `scripts/sync-worktree.mjs`
- `scripts/lib/env-bootstrap.mjs`
- `scripts/lib/runtime.js`
- `scripts/lib/runtime.mjs`
- `docs/operations/agent-secret-access.md`
- `cube/docker-compose.yml`
- `__tests__/scripts/envBootstrap.test.ts`
- `__tests__/scripts/sessionDoctorSshFallback.test.ts`
- `__tests__/scripts/worktreeAuthFailureClassification.test.ts`

## Existing Implementations Found

- Local app runs are staging-backed through `.env.local.refs`, `env:doctor`, and `env:run`.
- Worktree creation is already standardized by `npm run worktree:new`.
- `session:doctor` already reports checkout/worktree hygiene and direct SSH fallback details.
- `op:agent-doctor` already checks service-account token shape, 1Password CLI, and expected vault items.
- `peer-review` already accepts `PEER_REVIEW_CMD`, but its default Codex CLI flags are stale.

## Sites Affected

Implementation files:

- `package.json`
- `scripts/dev-doctor.mjs`
- `scripts/env-doctor.mjs`
- `scripts/op-agent-doctor.mjs`
- `scripts/peer-review.mjs`
- `scripts/lib/node-version.mjs`

Test files referencing changed APIs:

- `__tests__/scripts/devDoctor.test.ts`
- `__tests__/scripts/envDoctorSource.test.ts`
- `__tests__/scripts/nodeVersion.test.ts`
- `__tests__/scripts/opAgentDoctorSource.test.ts`
- `__tests__/scripts/peerReviewSource.test.ts`

Type definitions/usages:

- None expected.

Documentation referencing changed names:

- `README.md`
- `docs/operations/agent-secret-access.md`

## ADRs That Apply

- Existing agent secret access addenda referenced by `docs/operations/agent-secret-access.md`.

## Scope

In:

- Add a non-secret `dev:doctor` that checks Node version, package manager availability, 1Password CLI presence, env reference file presence, global Git hook risk, and local service hints.
- Make `env:doctor` print the active credential lane promised by the operations doc.
- Make `op:agent-doctor` stop treating the approved `preprod` label as production by substring alone, while retaining obvious production/admin blocks.
- Update `peer-review` to use current Codex CLI flags by default.
- Clarify README and operations docs around staging-backed local dev versus OrbStack-backed local infrastructure.

Out:

- No mutation of Tim's global Git config.
- No secret reads beyond existing doctors.
- No new fully local Supabase/PostHog/Redis/Inngest compose stack in this pass.
- No production data, deployment, migration, or secret-permission changes.

## Edge Cases

- Loading: doctors should run without network except existing env/op doctors.
- Empty: missing `.env.local.refs`, missing `op`, or missing Git config should produce advisories/blockers, not stack traces.
- Error: sandboxed network restrictions should be described as likely environment boundaries when detected by existing doctors.
- Mobile 375px: not applicable; no UI changes.
- A11y: not applicable; no UI changes.
- Auth: do not print raw tokens, op refs, or secret values.
- Data freshness: docs should describe current repo behavior, not future fully local behavior as if it exists.

## Verification Plan

- URL: not applicable; no app UI change.
- Screenshot: not applicable; no app UI change.
- Grep-similar: search for stale Codex flag, active credential lane doc/script agreement, and `dev:doctor` script exposure.
- Tests/checks:
  - `npm run test:unit -- __tests__/scripts`
  - `node --check scripts/dev-doctor.mjs`
  - `node --check scripts/env-doctor.mjs`
  - `node --check scripts/op-agent-doctor.mjs`
  - `node --check scripts/peer-review.mjs`
  - `npm run dev:doctor`
  - `npm run env:doctor`
  - `npm run op:agent-doctor`

## Evidence Trail

Commands run:

- `npm run worktree:new -- dev-env-hardening`
- `PATH=/Users/tim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm install`
- `PATH=/Users/tim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run test:unit -- __tests__/scripts`
- `npm run dev:doctor`
- `npm run env:doctor`
- `npm run op:agent-doctor`
- `PATH=/Users/tim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run format:check`
- `PATH=/Users/tim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run agent:validate`
- `PATH=/Users/tim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/eslint --no-ignore <changed files>`
- `npm run gh:auth-status`
- `npm run peer-review -- --diff`
- `PATH=/Users/tim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run type-check`

Claims verified:

- Worktree branch `feat/dev-env-hardening` was created at `.claude/worktrees/dev-env-hardening`.
- Baseline script test slice passed with 16 test files and 160 tests.
- Dependency install requires network outside Codex sandbox and exposes Node minimum drift against Node 24.14.0.
- Final script test slice passed with 21 test files and 168 tests.
- `env:doctor` resolves all 20 non-GitHub refs outside the Codex sandbox and prints the active credential lane.
- `op:agent-doctor` passes outside the Codex sandbox after the `preprod` item-name guard fix.
- `dev:doctor` reports the current machine advisories without resolving secrets: Node 25, global `core.hooksPath`, and sandbox-blocked Docker socket access.
- `peer-review` now uses the current Codex CLI flag shape, but the wrapper is still blocked inside this sandbox by readonly `~/.codex` state initialization.
- TypeScript type-check passed.
