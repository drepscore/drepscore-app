#!/usr/bin/env node

// project — interact with the Governada GitHub Project v2 backlog board
// (Phase B1b of Horizon 2). The Project is created and configured manually
// in the UI; this CLI reads and updates items through the governed `gh
// project` lane.
//
// One-time setup:
//   1. Visit https://github.com/orgs/governada/projects/new and create a
//      Project (suggested name: "Governada Backlog").
//   2. Add a single-select field named "Status" with options:
//      Backlog, Ready, In Progress, In Review, Done.
//   3. Project Settings → Workflows: enable
//        - "Auto-add to project" for any issue with a priority/* label.
//        - "Item closed → set Status: Done."
//        - (Optional) "When labeled status/in-progress → set Status: In Progress."
//   4. Set GOVERNADA_PROJECT_NUMBER=<N> in your shell env (find N in the
//      Project's URL).
//
// Usage:
//   npm run project -- list [--status STATUS]
//   npm run project -- add <issue#>
//   npm run project -- set-status <issue#> <status-name>

import { spawn } from 'node:child_process';
import path from 'node:path';

import {
  DEFAULT_PROJECT_OWNER,
  filterItemsByStatus,
  findFieldByName,
  findItemByIssueNumber,
  findOptionByName,
  groupItemsByStatus,
  STATUS_FIELD_NAME,
} from './lib/projects.mjs';
import { getScriptContext } from './lib/runtime.mjs';

const USAGE = [
  'Usage:',
  '  npm run project -- list [--status STATUS]',
  '  npm run project -- add <issue#>',
  '  npm run project -- set-status <issue#> <status-name>',
  '',
  'Requires GOVERNADA_PROJECT_NUMBER set (and optionally GOVERNADA_PROJECT_OWNER,',
  'default: governada). See the script header for one-time setup.',
].join('\n');

function fail(message) {
  console.error(`BLOCKED: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    command: '',
    issue: '',
    status: '',
    statusFilter: '',
    owner: process.env.GOVERNADA_PROJECT_OWNER || DEFAULT_PROJECT_OWNER,
    projectNumber: process.env.GOVERNADA_PROJECT_NUMBER || '',
  };
  if (argv.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  options.command = argv[0];
  const rest = argv.slice(1);

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--status') {
      const value = rest[i + 1];
      if (!value) {
        fail(`--status requires a value.\n${USAGE}`);
      }
      options.statusFilter = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (/^\d+$/u.test(arg) && !options.issue) {
      options.issue = arg;
    } else if (options.command === 'set-status' && !options.status && /^[A-Za-z]/u.test(arg)) {
      options.status = arg;
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
        const formatIndex = args.indexOf('--format');
        if (formatIndex !== -1 && args[formatIndex + 1] === 'json') {
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

function requireProjectNumber(options) {
  if (!options.projectNumber) {
    fail('GOVERNADA_PROJECT_NUMBER is not set. See `npm run project -- --help` for setup.');
  }
}

async function fetchItems(runGh, options) {
  const result = await runGh([
    'project',
    'item-list',
    options.projectNumber,
    '--owner',
    options.owner,
    '--format',
    'json',
    '--limit',
    '200',
  ]);
  return Array.isArray(result?.items) ? result.items : [];
}

async function fetchFields(runGh, options) {
  const result = await runGh([
    'project',
    'field-list',
    options.projectNumber,
    '--owner',
    options.owner,
    '--format',
    'json',
  ]);
  return Array.isArray(result?.fields) ? result.fields : [];
}

async function fetchProjectId(runGh, options) {
  const result = await runGh([
    'project',
    'view',
    options.projectNumber,
    '--owner',
    options.owner,
    '--format',
    'json',
  ]);
  return result?.id || null;
}

function renderItem(item) {
  const status = item?.[STATUS_FIELD_NAME] || '(no status)';
  const ref = item?.content?.number ? `#${item.content.number}` : '(draft)';
  const title = item?.title || item?.content?.title || '(no title)';
  return `  ${ref}  [${status}]  ${title}`;
}

async function cmdList(runGh, options) {
  requireProjectNumber(options);
  const items = await fetchItems(runGh, options);
  const filtered = options.statusFilter ? filterItemsByStatus(items, options.statusFilter) : items;

  if (filtered.length === 0) {
    console.log('No matching items.');
    return;
  }

  if (options.statusFilter) {
    console.log(`${filtered.length} item(s) with Status=${options.statusFilter}:`);
    for (const item of filtered) {
      console.log(renderItem(item));
    }
    return;
  }

  console.log(`${filtered.length} item(s) on the board:`);
  const groups = groupItemsByStatus(filtered);
  for (const [status, group] of groups) {
    console.log('');
    console.log(`${status} (${group.length}):`);
    for (const item of group) {
      console.log(renderItem(item));
    }
  }
}

async function cmdAdd(runGh, options) {
  requireProjectNumber(options);
  if (!options.issue) {
    fail(`add requires an issue number.\n${USAGE}`);
  }
  const url = `https://github.com/governada/app/issues/${options.issue}`;
  await runGh([
    'project',
    'item-add',
    options.projectNumber,
    '--owner',
    options.owner,
    '--url',
    url,
  ]);
  console.log(`Added issue #${options.issue} to project ${options.projectNumber}.`);
}

async function cmdSetStatus(runGh, options) {
  requireProjectNumber(options);
  if (!options.issue) {
    fail(`set-status requires an issue number.\n${USAGE}`);
  }
  if (!options.status) {
    fail(`set-status requires a status name.\n${USAGE}`);
  }

  const [projectId, fields, items] = await Promise.all([
    fetchProjectId(runGh, options),
    fetchFields(runGh, options),
    fetchItems(runGh, options),
  ]);

  if (!projectId) {
    fail('could not resolve project ID; check GOVERNADA_PROJECT_NUMBER.');
  }

  const statusField = findFieldByName(fields, STATUS_FIELD_NAME);
  if (!statusField) {
    fail(`project has no "${STATUS_FIELD_NAME}" field. Add it in the Project UI.`);
  }

  const option = findOptionByName(statusField, options.status);
  if (!option) {
    const available = (statusField.options || []).map((opt) => opt.name).join(', ');
    fail(`status "${options.status}" not found. Available: ${available || '(none)'}`);
  }

  const item = findItemByIssueNumber(items, options.issue);
  if (!item) {
    fail(
      `issue #${options.issue} is not on the project. Add it first with \`npm run project -- add ${options.issue}\`.`,
    );
  }

  await runGh([
    'project',
    'item-edit',
    '--id',
    item.id,
    '--project-id',
    projectId,
    '--field-id',
    statusField.id,
    '--single-select-option-id',
    option.id,
  ]);
  console.log(`Set issue #${options.issue} to Status=${options.status}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runGh = makeRunGh();

  switch (options.command) {
    case 'list':
      await cmdList(runGh, options);
      break;
    case 'add':
      await cmdAdd(runGh, options);
      break;
    case 'set-status':
      await cmdSetStatus(runGh, options);
      break;
    default:
      fail(`unknown command: ${options.command}\n${USAGE}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
