#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { ENV_REFS_FILE, findEnvRefsFile, getAgentRuntimeFile } from './lib/env-bootstrap.mjs';
import {
  MAX_EXCLUSIVE_NODE_VERSION,
  MIN_SUPPORTED_NODE_VERSION,
  formatVersionParts,
  isNodeVersionSupported,
} from './lib/node-version.mjs';
import { getScriptContext } from './lib/runtime.mjs';

const CHECK_TIMEOUT_MS = 3000;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs || CHECK_TIMEOUT_MS,
  });

  return {
    error: result.error,
    signal: result.signal,
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || '',
    timedOut: result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM',
  };
}

function firstLine(value) {
  return (
    String(value)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) || ''
  );
}

function redacted(value) {
  return String(value)
    .replace(/op:\/\/[^\s'"`]+/gu, 'op://[redacted]')
    .replace(/\bops_[A-Za-z0-9_=-]{20,}\b/gu, '[redacted-op-service-account-token]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/gu, '[redacted-token]');
}

function detail(result) {
  if (result.timedOut) {
    return `timed out after ${CHECK_TIMEOUT_MS}ms`;
  }
  return firstLine(redacted(result.stderr || result.stdout)) || `exit ${result.status}`;
}

function checkNode(advisories) {
  const current = process.versions.node;
  const range = `>=${formatVersionParts(MIN_SUPPORTED_NODE_VERSION)} <${formatVersionParts(
    MAX_EXCLUSIVE_NODE_VERSION,
  )}`;

  if (isNodeVersionSupported(current)) {
    console.log(`OK: Node ${current} satisfies ${range}`);
    return;
  }

  advisories.push(`Node ${current} does not satisfy ${range}.`);
  console.log(`WARN: Node ${current} does not satisfy ${range}`);
}

function checkNpm(advisories) {
  const result = run('npm', ['--version']);
  if (result.status === 0) {
    console.log(`OK: npm ${firstLine(result.stdout)} is available`);
    return;
  }

  advisories.push(`npm is not available (${detail(result)}).`);
  console.log(`WARN: npm is not available (${detail(result)})`);
}

function checkEnvRefs(repoRoot, advisories) {
  const refsPath = findEnvRefsFile(repoRoot);
  if (refsPath) {
    console.log(`OK: ${ENV_REFS_FILE} found at ${refsPath}`);
    return;
  }

  advisories.push(`${ENV_REFS_FILE} not found; env:run cannot inject staging-backed app env.`);
  console.log(`WARN: ${ENV_REFS_FILE} not found; run npm run env:doctor for detail`);
}

function checkAgentRuntimeFile(advisories) {
  const runtimeFile = getAgentRuntimeFile();
  if (existsSync(runtimeFile)) {
    console.log(`OK: agent runtime env file exists at ${runtimeFile}`);
    return;
  }

  advisories.push(`Agent runtime env file is missing at ${runtimeFile}.`);
  console.log(`WARN: agent runtime env file missing at ${runtimeFile}`);
}

function checkOnePasswordCli(advisories) {
  const result = run('op', ['--version']);
  if (result.status === 0) {
    console.log(`OK: 1Password CLI ${firstLine(result.stdout)} is available`);
    return;
  }

  advisories.push(`1Password CLI is not available (${detail(result)}).`);
  console.log(`WARN: 1Password CLI is not available (${detail(result)})`);
}

function checkGlobalGitHooks(advisories) {
  const result = run('git', ['config', '--global', '--get', 'core.hooksPath']);
  if (result.status !== 0 || !result.stdout.trim()) {
    console.log('OK: global git core.hooksPath is not set');
    return;
  }

  const hookPath = result.stdout.trim();
  advisories.push(
    `Global git core.hooksPath is set to ${hookPath}; repo tests that spawn git may inherit it.`,
  );
  console.log(`WARN: global git core.hooksPath is set to ${hookPath}`);
}

function checkDocker(advisories) {
  const result = run('docker', ['version', '--format', '{{.Server.Version}}']);
  if (result.status === 0 && result.stdout.trim()) {
    console.log(`OK: OrbStack/Docker server is available (${firstLine(result.stdout)})`);
    return;
  }

  advisories.push(
    `OrbStack/Docker is not reachable (${detail(
      result,
    )}); default staging-backed app dev can still work, but migration replay and Cube local services need Docker.`,
  );
  console.log(`WARN: OrbStack/Docker is not reachable (${detail(result)})`);
}

function main() {
  const { repoRoot } = getScriptContext(import.meta.url);
  const advisories = [];

  console.log('Dev doctor: Governada local development readiness');
  console.log(
    'Local dev profile: staging-backed Next.js app via env:run; OrbStack/Docker supports Supabase migration replay and Cube local services.',
  );
  console.log('');

  checkNode(advisories);
  checkNpm(advisories);
  checkEnvRefs(repoRoot, advisories);
  checkAgentRuntimeFile(advisories);
  checkOnePasswordCli(advisories);
  checkGlobalGitHooks(advisories);
  checkDocker(advisories);

  console.log('');
  console.log('Next commands:');
  console.log('  npm run env:doctor');
  console.log('  npm run env:run -- npm run dev');
  console.log('  npm run inngest:dev  # optional local Inngest event server');
  console.log('');

  if (advisories.length > 0) {
    console.log(`Dev doctor result: PASS_WITH_ADVISORIES (${advisories.length} advisory item(s))`);
    return;
  }

  console.log('Dev doctor result: PASS');
}

main();
