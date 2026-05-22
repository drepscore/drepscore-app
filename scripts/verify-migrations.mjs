#!/usr/bin/env node
// scripts/verify-migrations.mjs
//
// Replays the full Supabase migration history on a fresh local stack and
// asserts it applies cleanly. This is a PURE verifier — no git or CI logic —
// so it is the single canonical entrypoint for both the `migrations` CI job
// and local development (`npm run migrations:verify`).
//
// Mechanism: `supabase start` boots the local stack (Docker); `supabase db
// reset` recreates the Postgres container and replays every file in
// supabase/migrations/ in order (plus supabase/seed.sql if present). A
// parse-time or replay-order failure — the F3/F4/F16 bug class — makes
// `db reset` exit non-zero.
//
// A local stack carries the OSS `supabase_migrations.schema_migrations` column
// set, not the hosted-platform additions (created_by, idempotency_key,
// rollback) — i.e. the same fresh-database condition a Supabase preview branch
// has. See governada-brain/plans/migration-replay-ci-gate.md.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, { capture = false } = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
}

function fail(message) {
  console.error(`\n✖ migrations:verify — ${message}`);
  process.exit(1);
}

function requireTool(command, args, label, remediation) {
  const result = run(command, args, { capture: true });
  if (result.error || result.status !== 0) {
    fail(`${label}\n  ${remediation}`);
  }
}

console.log('=== migrations:verify — Supabase migration replay ===\n');

// 1. Preflight: the Supabase CLI must be on PATH.
requireTool(
  'supabase',
  ['--version'],
  'Supabase CLI not found on PATH.',
  'Install it: https://supabase.com/docs/guides/local-development (e.g. `brew install supabase/tap/supabase`).',
);

// 2. Preflight: the Docker daemon must be reachable (the local stack runs in
//    containers). Works with Docker Desktop or OrbStack.
requireTool(
  'docker',
  ['info'],
  'Docker is not available or its daemon is not running.',
  'Start Docker Desktop or OrbStack, then re-run.',
);

// 3. Boot the local Supabase stack. Idempotent — reuses an already-running
//    stack. A broken migration can fail here too (the stack applies migrations
//    on first start), which is still a correct failure of this gate.
console.log('• Booting the local Supabase stack (supabase start)...\n');
const start = run('supabase', ['start']);
if (start.status !== 0) {
  fail(
    '`supabase start` failed — see output above.\n' +
      '  This can be a broken migration or a local-stack issue.',
  );
}

// 4. Clean replay: `supabase db reset` recreates the database container and
//    applies every migration in supabase/migrations/ in order from scratch.
console.log('\n• Replaying migrations on a fresh database (supabase db reset)...\n');
const reset = run('supabase', ['db', 'reset']);
if (reset.status !== 0) {
  fail(
    '`supabase db reset` failed — a migration did not apply cleanly on a fresh database.\n' +
      '  This is the F3/F4/F16 failure class (parse-time error or bad replay order).\n' +
      '  Fix the offending file in supabase/migrations/ and re-run.',
  );
}

console.log('\n✔ migrations:verify — all migrations replayed cleanly on a fresh database.');
console.log('  (The local stack is left running; `supabase stop` to tear it down.)');
