#!/usr/bin/env node

// seed-backlog — bootstrap the GitHub Issues backlog from docs/manifest.md
// "Not Shipped" items. Idempotent: skips items whose title already exists.
// Also bootstraps the priority/status/risk-tier labels on --apply.
//
// Usage:
//   npm run seed-backlog -- [--dry-run]   (default; show what would happen)
//   npm run seed-backlog -- --apply        (create missing labels + issues)
//
// Routes through bin/gh.sh by default. GOVERNADA_GH_BIN overrides.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  BACKLOG_LABEL_DEFS,
  buildIssueSpec,
  filterUnseeded,
  parseManifest,
} from './lib/seed-backlog.mjs';
import { getScriptContext } from './lib/runtime.mjs';

const USAGE = 'Usage:\n  npm run seed-backlog -- [--dry-run | --apply]\n\nDefault is --dry-run.';

function fail(message) {
  console.error(`BLOCKED: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    repo: process.env.GOVERNADA_BACKLOG_REPO || 'governada/app',
  };
  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--dry-run') {
      options.apply = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      fail(`unrecognized argument: ${arg}\n${USAGE}`);
    }
  }
  return options;
}

function resolveGhBin() {
  if (process.env.GOVERNADA_GH_BIN) {
    return process.env.GOVERNADA_GH_BIN;
  }
  const { repoRoot } = getScriptContext(import.meta.url);
  return path.join(repoRoot, 'bin', 'gh.sh');
}

function makeRunGh() {
  const ghBin = resolveGhBin();
  return function runGh(args) {
    return new Promise((resolve, reject) => {
      const child = spawn(ghBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', (error) => reject(error));
      child.on('close', (status) => {
        if (status !== 0) {
          reject(new Error(stderr.trim() || `${ghBin} ${args.join(' ')} exited ${status}`));
          return;
        }
        if (args.includes('--json')) {
          try {
            resolve(stdout ? JSON.parse(stdout) : null);
          } catch (parseError) {
            reject(parseError);
          }
        } else {
          resolve(stdout.trim());
        }
      });
    });
  };
}

async function fetchExistingIssueTitles(runGh, repo) {
  const data = await runGh([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--json',
    'title',
    '--limit',
    '500',
  ]);
  return (Array.isArray(data) ? data : []).map((issue) => issue?.title || '');
}

async function fetchExistingLabelNames(runGh, repo) {
  const data = await runGh(['label', 'list', '--repo', repo, '--json', 'name', '--limit', '200']);
  return new Set((Array.isArray(data) ? data : []).map((label) => label?.name).filter(Boolean));
}

async function bootstrapLabels(runGh, repo) {
  const existing = await fetchExistingLabelNames(runGh, repo);
  const created = [];
  for (const def of BACKLOG_LABEL_DEFS) {
    if (existing.has(def.name)) {
      continue;
    }
    await runGh([
      'label',
      'create',
      def.name,
      '--repo',
      repo,
      '--color',
      def.color,
      '--description',
      def.description,
      '--force',
    ]);
    created.push(def.name);
  }
  return created;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { repoRoot } = getScriptContext(import.meta.url);
  const manifestPath = path.join(repoRoot, 'docs', 'manifest.md');
  const content = readFileSync(manifestPath, 'utf8');
  const items = parseManifest(content);

  if (items.length === 0) {
    console.log('No "Not Shipped" items found in docs/manifest.md.');
    return;
  }

  const runGh = makeRunGh();
  console.log(`Parsed ${items.length} backlog item(s) from manifest.`);

  const existingTitles = await fetchExistingIssueTitles(runGh, options.repo);
  const specs = items.map(buildIssueSpec);
  const toCreate = filterUnseeded(specs, existingTitles);

  console.log(`${existingTitles.length} existing issue title(s) considered for dedup.`);
  console.log(`${toCreate.length} new issue(s) to create:`);
  for (const spec of toCreate) {
    console.log(`  [${spec.labels.join(',')}]  ${spec.title}`);
  }

  if (!options.apply) {
    console.log('');
    console.log('Dry-run. Re-run with --apply to bootstrap labels and create issues.');
    return;
  }

  if (toCreate.length === 0) {
    console.log('Backlog already seeded — no new issues to create.');
    return;
  }

  console.log('');
  console.log('Bootstrapping labels...');
  const newLabels = await bootstrapLabels(runGh, options.repo);
  if (newLabels.length === 0) {
    console.log('  (all labels already exist)');
  } else {
    for (const name of newLabels) {
      console.log(`  + created ${name}`);
    }
  }

  console.log('');
  console.log('Creating issues...');
  for (const spec of toCreate) {
    const args = [
      'issue',
      'create',
      '--repo',
      options.repo,
      '--title',
      spec.title,
      '--body',
      spec.body,
    ];
    for (const label of spec.labels) {
      args.push('--label', label);
    }
    const url = await runGh(args);
    console.log(`  + ${spec.title}\n    ${url}`);
  }
  console.log('');
  console.log('Done.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
