#!/usr/bin/env node

// env:run — run a command with the local Governada environment injected.
//
// Resolves the 1Password references in .env.local.refs through the agent
// service-account lane and injects them (with the `_OP_REF` suffix stripped)
// into the spawned command's environment. Secrets exist only in the child
// process env — never written to disk, never logged.
//
// Usage: npm run env:run -- <command> [args...]
//   e.g. npm run env:run -- npm run dev

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

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

const USAGE = 'npm run env:run -- <command> [args...]';

function fail(message, remediation) {
  console.error(`BLOCKED: ${message}`);
  if (remediation) {
    console.error(`Remediation: ${remediation}`);
  }
  process.exit(1);
}

function parseArgs(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  if (args.length === 0) {
    console.error(`Usage: ${USAGE}`);
    process.exit(1);
  }
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`Usage: ${USAGE}`);
    process.exit(0);
  }
  return args;
}

async function main() {
  const command = parseArgs(process.argv.slice(2));
  const { repoRoot } = getScriptContext(import.meta.url);

  const refsPath = findEnvRefsFile(repoRoot);
  if (!refsPath) {
    fail(
      `no ${ENV_REFS_FILE} found in this checkout or shared root`,
      'run `npm run env:doctor` to diagnose local environment bootstrap',
    );
  }

  const { refs, literals } = planInjection(parseEnvEntries(readFileSync(refsPath, 'utf8')));

  const injected = { ...process.env };
  for (const literal of literals) {
    injected[literal.envKey] = literal.value;
  }

  if (refs.length > 0) {
    const { token, file, reason } = readAgentToken();
    if (!token) {
      fail(
        `agent 1Password service-account token unavailable: ${reason} (${file})`,
        'run `npm run env:doctor`; configure OP_AGENT_SERVICE_ACCOUNT_TOKEN in the agent runtime file',
      );
    }

    const version = opVersion(token);
    if (version.error || version.status !== 0) {
      fail(
        '1Password CLI (`op`) is not installed or not runnable from this process',
        'install the 1Password CLI, then retry',
      );
    }

    const resolved = await Promise.all(
      refs.map(async (ref) => ({ ref, resolution: await resolveOpRef(ref.opRef, token) })),
    );
    // Inject what resolves; skip what does not. A single misconfigured
    // reference must not brick local dev — the app's own env validation will
    // flag anything genuinely critical that ends up missing.
    const unresolved = [];
    for (const { ref, resolution } of resolved) {
      if (resolution.ok) {
        injected[ref.envKey] = resolution.value;
      } else {
        unresolved.push(ref.sourceKey);
      }
    }
    if (unresolved.length > 0) {
      console.error(
        `WARN: env:run skipped ${unresolved.length} unresolvable reference(s): ` +
          `${unresolved.join(', ')}`,
      );
      console.error('Remediation: run `npm run env:doctor` for detail.');
    }
  }

  const child = spawn(command[0], command.slice(1), {
    cwd: process.cwd(),
    env: injected,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    if (error.code === 'ENOENT') {
      fail(`command not found: ${command[0]}`);
    }
    fail(`command failed to start: ${error.message}`);
  });
  child.on('close', (status, signal) => {
    if (signal) {
      console.error(`Command terminated by signal ${signal}`);
      process.exit(1);
    }
    process.exit(status ?? 1);
  });
}

main();
