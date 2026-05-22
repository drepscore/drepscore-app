// Shared helpers for the local environment bootstrap lane (env:run, env:doctor).
//
// .env.local.refs holds `KEY_OP_REF=op://...` 1Password references (and a few
// non-secret literals). env:run resolves the references through the agent
// service-account lane and injects them, with the `_OP_REF` suffix stripped,
// into a child process — never to disk. Pattern mirrors bin/supabase-mcp.sh.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const ENV_LOCAL_FILE = '.env.local';
export const ENV_REFS_FILE = '.env.local.refs';

const DEFAULT_AGENT_RUNTIME_FILE = '/Users/tim/dev/agent-runtime/env/governada-agent.env';
const OP_REF_SUFFIX = '_OP_REF';
const OP_READ_TIMEOUT_MS = 20000;
const MAX_OP_REF_DEPTH = 5;

// Keys owned by the GitHub auth lane (bin/gh.sh, mint-installation-token.mjs).
// env:run must never inject these into an application runtime — the GitHub App
// private key has no business in `next dev`.
const GITHUB_LANE_KEY = /^(GOVERNADA_GITHUB_|GH_TOKEN|GITHUB_TOKEN)/u;

// Parse env-file contents into ordered { key, value } entries. Tolerates
// `export ` prefixes, surrounding quotes, and trailing `# comments`.
export function parseEnvEntries(contents) {
  const entries = [];

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice(7).trimStart() : line;
    const separator = normalized.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = normalized.slice(0, separator).trim();
    if (!key) {
      continue;
    }

    let value = normalized.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }

    entries.push({ key, value });
  }

  return entries;
}

export function isOpReference(value) {
  return typeof value === 'string' && value.startsWith('op://');
}

export function stripOpRefSuffix(key) {
  return key.endsWith(OP_REF_SUFFIX) ? key.slice(0, -OP_REF_SUFFIX.length) : key;
}

export function isGitHubLaneKey(key) {
  return GITHUB_LANE_KEY.test(stripOpRefSuffix(key));
}

// Pure classification of .env.local.refs entries into what env:run does with
// each: resolve a reference, pass a literal through, or skip a GitHub-lane key.
export function planInjection(entries) {
  const refs = [];
  const literals = [];
  const skipped = [];

  for (const { key, value } of entries) {
    if (isGitHubLaneKey(key)) {
      skipped.push(key);
      continue;
    }

    const envKey = stripOpRefSuffix(key);
    if (isOpReference(value)) {
      refs.push({ sourceKey: key, envKey, opRef: value });
    } else {
      literals.push({ sourceKey: key, envKey, value });
    }
  }

  return { refs, literals, skipped };
}

// Locate .env.local.refs, falling back to the shared checkout when invoked from
// a worktree that lacks its own copy (mirrors bin/supabase-mcp.sh).
export function findEnvRefsFile(repoRoot) {
  const local = path.join(repoRoot, ENV_REFS_FILE);
  if (existsSync(local)) {
    return local;
  }

  const marker = `${path.sep}.claude${path.sep}worktrees${path.sep}`;
  const markerIndex = repoRoot.indexOf(marker);
  if (markerIndex !== -1) {
    const shared = path.join(repoRoot.slice(0, markerIndex), ENV_REFS_FILE);
    if (existsSync(shared)) {
      return shared;
    }
  }

  return null;
}

export function getAgentRuntimeFile() {
  return process.env.OP_AGENT_RUNTIME_FILE || DEFAULT_AGENT_RUNTIME_FILE;
}

// Read the 1Password service-account token from the agent runtime file. The
// token never lives in the repo; reason distinguishes failure modes for the
// doctor's remediation output.
export function readAgentToken() {
  const file = getAgentRuntimeFile();
  if (!existsSync(file)) {
    return { token: null, file, reason: 'missing runtime file' };
  }

  const entry = parseEnvEntries(readFileSync(file, 'utf8')).findLast(
    (candidate) => candidate.key === 'OP_AGENT_SERVICE_ACCOUNT_TOKEN',
  );
  const token = entry?.value || '';
  if (!token) {
    return { token: null, file, reason: 'OP_AGENT_SERVICE_ACCOUNT_TOKEN absent' };
  }
  if (!token.startsWith('ops_')) {
    return { token: null, file, reason: 'token is not a service-account token' };
  }

  return { token, file, reason: 'ok' };
}

// Environment for `op` invocations: the service-account token authenticates
// directly, so account/connect context must be cleared.
function opEnv(agentToken) {
  const env = { ...process.env };
  delete env.OP_AGENT_SERVICE_ACCOUNT_TOKEN;
  delete env.OP_ACCOUNT;
  delete env.OP_CONNECT_HOST;
  delete env.OP_CONNECT_TOKEN;
  env.OP_SERVICE_ACCOUNT_TOKEN = agentToken;
  return env;
}

export function opVersion(agentToken) {
  return spawnSync('op', ['--version'], {
    encoding: 'utf8',
    env: opEnv(agentToken),
    timeout: 15000,
  });
}

// Resolve a single op:// reference. Async so callers can resolve many in
// parallel. Returns { status, stdout, stderr, error? }.
export function opRead(opRef, agentToken) {
  return new Promise((resolve) => {
    const child = spawn('op', ['read', opRef], { env: opEnv(agentToken) });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => child.kill('SIGTERM'), OP_READ_TIMEOUT_MS);

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: null, stdout: '', stderr: String(error), error });
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

// Resolve an op:// reference to a concrete value, following nested references
// (a 1Password field whose stored value is itself an op:// reference, e.g. a
// staging item that points at a canonical secret) up to a small depth bound.
// Returns { ok, value, depth, reason? }.
export async function resolveOpRef(opRef, agentToken) {
  let current = opRef;

  for (let depth = 0; depth < MAX_OP_REF_DEPTH; depth += 1) {
    const result = await opRead(current, agentToken);
    const value = (result.stdout || '').trimEnd();

    if (result.status !== 0 || !value) {
      return { ok: false, value: '', depth, reason: 'unresolved reference' };
    }
    if (!isOpReference(value)) {
      return { ok: true, value, depth };
    }

    current = value;
  }

  return {
    ok: false,
    value: '',
    depth: MAX_OP_REF_DEPTH,
    reason: 'max reference nesting depth exceeded',
  };
}
