#!/usr/bin/env node

// env:doctor — diagnose the local environment bootstrap.
//
// Verifies that env:run can resolve the staging environment in this checkout:
// the .env.local.refs file, the agent service-account token, the 1Password
// CLI, and a live sample resolution. Exits non-zero when a blocker is found.

import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ENV_REFS_FILE,
  findEnvRefsFile,
  opVersion,
  parseEnvEntries,
  planInjection,
  readAgentToken,
  resolveOpRef,
} from './lib/env-bootstrap.mjs';
import { getScriptContext } from './lib/runtime.mjs';

function checkoutKind(repoRoot) {
  try {
    return lstatSync(path.join(repoRoot, '.git')).isDirectory() ? 'shared checkout' : 'worktree';
  } catch {
    return 'unknown';
  }
}

function finish(blockers, warnings) {
  if (blockers.length > 0) {
    console.log(`Env doctor result: BLOCKED (${blockers.length} blocker(s))`);
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.log(`Env doctor result: PASS_WITH_ADVISORIES (${warnings.length} advisory item(s))`);
    return;
  }
  console.log('Env doctor result: PASS');
}

async function main() {
  const { repoRoot } = getScriptContext(import.meta.url);
  const blockers = [];
  const warnings = [];
  const ok = (message) => console.log(`OK: ${message}`);
  const warn = (message) => {
    warnings.push(message);
    console.log(`WARN: ${message}`);
  };
  const block = (message) => {
    blockers.push(message);
    console.log(`BLOCKED: ${message}`);
  };

  console.log('Env doctor: Governada local environment bootstrap');
  ok(`checkout kind: ${checkoutKind(repoRoot)}`);

  const refsPath = findEnvRefsFile(repoRoot);
  if (!refsPath) {
    block(`${ENV_REFS_FILE} not found in this checkout or shared root`);
    finish(blockers, warnings);
    return;
  }
  ok(`${ENV_REFS_FILE} found: ${refsPath}`);

  const { refs, literals, skipped } = planInjection(
    parseEnvEntries(readFileSync(refsPath, 'utf8')),
  );
  ok(
    `${refs.length} reference(s) to resolve, ${literals.length} literal(s), ` +
      `${skipped.length} GitHub-lane key(s) skipped`,
  );

  if (refs.length === 0) {
    warn('no op:// references found; env:run would inject literals only');
    finish(blockers, warnings);
    return;
  }

  const { token, file, reason } = readAgentToken();
  if (!token) {
    block(`agent service-account token unavailable: ${reason} (${file})`);
    finish(blockers, warnings);
    return;
  }
  ok(`agent service-account token present (${file})`);

  const version = opVersion(token);
  if (version.error?.code === 'ENOENT') {
    block('1Password CLI (`op`) is not installed or not on PATH');
    finish(blockers, warnings);
    return;
  }
  if (version.error || version.status !== 0) {
    block('1Password CLI (`op`) is not runnable from this process');
    finish(blockers, warnings);
    return;
  }
  ok(`1Password CLI available (${(version.stdout || '').trim() || 'version unknown'})`);

  // Resolve every reference so the doctor reports exactly what env:run can and
  // cannot inject. Secret values are held in memory only — never printed.
  const resolutions = await Promise.all(
    refs.map(async (ref) => ({ ref, resolution: await resolveOpRef(ref.opRef, token) })),
  );
  const resolved = resolutions.filter((entry) => entry.resolution.ok);
  const failed = resolutions.filter((entry) => !entry.resolution.ok);
  const nested = resolved.filter((entry) => entry.resolution.depth > 0);

  if (failed.length === 0) {
    ok(`all ${refs.length} reference(s) resolve from the agent vault`);
  } else {
    for (const { ref, resolution } of failed) {
      warn(`${ref.sourceKey} does not resolve (${resolution.reason})`);
    }
  }
  if (nested.length > 0) {
    ok(`${nested.length} reference(s) resolve through nested 1Password references`);
  }

  const injectable = [
    ...resolved.map((entry) => entry.ref.envKey),
    ...literals.map((lit) => lit.envKey),
  ]
    .sort()
    .join(', ');
  console.log('');
  console.log(`env:run will inject: ${injectable}`);

  finish(blockers, warnings);
}

main();
