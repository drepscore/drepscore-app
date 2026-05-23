#!/usr/bin/env node

// backlog — interact with the Governada backlog (GitHub Issues, B1a of
// Horizon 2). See scripts/lib/backlog.mjs for the interface.
//
// Usage:
//   npm run backlog -- list [--json]
//   npm run backlog -- next [--json]
//   npm run backlog -- view <issue#> [--json]
//   npm run backlog -- claim <issue#>
//   npm run backlog -- release <issue#>
//
// Defaults to the governed bin/gh.sh lane. Override with GOVERNADA_GH_BIN.

import { spawn } from 'node:child_process';
import path from 'node:path';

import {
  createGitHubBacklog,
  DEFAULT_REPO,
  extractPriority,
  hasInProgressLabel,
  IN_PROGRESS_LABEL,
  PRIORITY_LABELS,
  sortByPriority,
} from './lib/backlog.mjs';
import { getScriptContext } from './lib/runtime.mjs';

const USAGE = [
  'Usage:',
  '  npm run backlog -- list [--json]',
  '  npm run backlog -- next [--json]',
  '  npm run backlog -- view <issue#> [--json]',
  '  npm run backlog -- claim <issue#>',
  '  npm run backlog -- release <issue#>',
].join('\n');

function fail(message) {
  console.error(`BLOCKED: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    command: '',
    issue: '',
    json: false,
    repo: process.env.GOVERNADA_BACKLOG_REPO || DEFAULT_REPO,
  };
  if (argv.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }
  options.command = argv[0];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (/^\d+$/u.test(arg)) {
      options.issue = arg;
    } else {
      fail(`unrecognized argument: ${arg}\n${USAGE}`);
    }
  }
  return options;
}

function resolveGhBin() {
  const override = process.env.GOVERNADA_GH_BIN;
  if (override) {
    return override;
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

function renderIssueLine(issue) {
  const priority = extractPriority(issue?.labels);
  const priorityLabel = priority === null ? '(no priority)' : PRIORITY_LABELS[priority];
  const inProgress = hasInProgressLabel(issue?.labels) ? ' [in-progress]' : '';
  return `  #${issue.number}  ${priorityLabel}${inProgress}  ${issue.title}`;
}

async function cmdList(backlog, options) {
  const issues = await backlog.listOpen({ includeInProgress: true });
  if (options.json) {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }
  if (issues.length === 0) {
    console.log('No open issues.');
    return;
  }
  console.log(`${issues.length} open issue(s):`);
  for (const issue of sortByPriority(issues)) {
    console.log(renderIssueLine(issue));
  }
}

async function cmdNext(backlog, options) {
  const next = await backlog.nextItem();
  if (!next) {
    if (options.json) {
      console.log('null');
    } else {
      console.log(
        'No unclaimed issues. Backlog is empty or all open issues carry status/in-progress.',
      );
    }
    return;
  }
  if (options.json) {
    console.log(JSON.stringify(next, null, 2));
    return;
  }
  console.log('Next:');
  console.log(renderIssueLine(next));
  if (next.url) {
    console.log(`  ${next.url}`);
  }
}

async function cmdView(backlog, options) {
  if (!options.issue) {
    fail(`view requires an issue number.\n${USAGE}`);
  }
  const issue = await backlog.view(options.issue);
  if (options.json) {
    console.log(JSON.stringify(issue, null, 2));
    return;
  }
  const priority = extractPriority(issue?.labels);
  console.log(`#${issue.number}  ${issue.title}`);
  console.log(`  state:       ${issue.state ?? 'unknown'}`);
  console.log(`  priority:    ${priority === null ? '(unset)' : PRIORITY_LABELS[priority]}`);
  console.log(`  in-progress: ${hasInProgressLabel(issue?.labels) ? 'yes' : 'no'}`);
  if (issue.url) {
    console.log(`  url:         ${issue.url}`);
  }
  if (issue.body) {
    console.log('');
    console.log(issue.body);
  }
}

async function cmdClaim(backlog, options) {
  if (!options.issue) {
    fail(`claim requires an issue number.\n${USAGE}`);
  }
  await backlog.claim(options.issue);
  console.log(`Claimed issue #${options.issue} — added ${IN_PROGRESS_LABEL} label.`);
}

async function cmdRelease(backlog, options) {
  if (!options.issue) {
    fail(`release requires an issue number.\n${USAGE}`);
  }
  await backlog.release(options.issue);
  console.log(`Released issue #${options.issue} — removed ${IN_PROGRESS_LABEL} label.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runGh = makeRunGh();
  const backlog = createGitHubBacklog({ runGh, repo: options.repo });

  switch (options.command) {
    case 'list':
      await cmdList(backlog, options);
      break;
    case 'next':
      await cmdNext(backlog, options);
      break;
    case 'view':
      await cmdView(backlog, options);
      break;
    case 'claim':
      await cmdClaim(backlog, options);
      break;
    case 'release':
      await cmdRelease(backlog, options);
      break;
    default:
      fail(`unknown command: ${options.command}\n${USAGE}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
