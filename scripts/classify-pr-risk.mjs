#!/usr/bin/env node

// classify-pr-risk — classify a PR's risk tier (low / standard / high) using
// scripts/lib/pr-risk.mjs.
//
// Usage:
//   node scripts/classify-pr-risk.mjs [--json] <PR#>
//     Fetches PR metadata via `gh pr view` and classifies it. CI uses this
//     form, with GH_TOKEN set from secrets.GITHUB_TOKEN.
//
//   node scripts/classify-pr-risk.mjs --stdin [--json]
//     Reads PR JSON from stdin (the output of
//     `gh pr view <pr> --json number,title,body,additions,deletions,files`).
//     Use this locally with the governed gh wrapper:
//       npm run gh -- pr view <pr> --json ... | node scripts/classify-pr-risk.mjs --stdin

import { spawnSync } from 'node:child_process';
import { classifyPrRisk } from './lib/pr-risk.mjs';

const USAGE =
  'Usage: node scripts/classify-pr-risk.mjs [--json] <PR#>\n' +
  '       node scripts/classify-pr-risk.mjs --stdin [--json]';

function fail(message) {
  console.error(`BLOCKED: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { json: false, stdin: false, pr: '' };
  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--stdin') {
      options.stdin = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (/^\d+$/u.test(arg)) {
      options.pr = arg;
    } else {
      fail(`unrecognized argument: ${arg}\n${USAGE}`);
    }
  }
  if (options.stdin && options.pr) {
    fail('--stdin and <PR#> are mutually exclusive');
  }
  if (!options.stdin && !options.pr) {
    fail(`PR number required.\n${USAGE}`);
  }
  return options;
}

function fetchPrViaGh(pr) {
  const ghBin = process.env.GOVERNADA_GH_BIN || 'gh';
  const result = spawnSync(
    ghBin,
    ['pr', 'view', pr, '--json', 'number,title,body,additions,deletions,files'],
    { encoding: 'utf8', timeout: 60_000 },
  );
  if (result.error?.code === 'ENOENT') {
    fail(`gh binary not found: ${ghBin}`);
  }
  if (result.status !== 0 || result.error) {
    const detail = (result.stderr || result.error?.message || '').trim();
    fail(`gh pr view ${pr} failed: ${detail || 'unknown error'}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`gh returned non-JSON output: ${error.message}`);
  }
  return null;
}

async function readStdin() {
  process.stdin.setEncoding('utf8');
  let buffer = '';
  for await (const chunk of process.stdin) {
    buffer += chunk;
  }
  if (!buffer.trim()) {
    fail('--stdin specified but no input received');
  }
  try {
    return JSON.parse(buffer);
  } catch (error) {
    fail(`stdin is not valid JSON: ${error.message}`);
  }
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = options.stdin ? await readStdin() : fetchPrViaGh(options.pr);
  const classification = classifyPrRisk(data);

  if (options.json) {
    console.log(
      JSON.stringify({
        pr: data?.number ?? null,
        tier: classification.tier,
        reasons: classification.reasons,
      }),
    );
    return;
  }

  const prLabel = data?.number ? `PR #${data.number}` : 'PR (stdin)';
  console.log(`${prLabel} — tier: ${classification.tier}`);
  for (const reason of classification.reasons) {
    console.log(`  - ${reason}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
