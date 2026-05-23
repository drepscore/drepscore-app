const fs = require('node:fs');
const path = require('node:path');

const { getSharedCheckoutRoot, isSharedCheckout, repoRoot, runCommand } = require('./lib/runtime');

const worktreeRoot = path.join(repoRoot, '.claude', 'worktrees');

const allowedFlags = new Set(['--clean', '--clean-all', '--force-dirty']);
const args = process.argv.slice(2);
for (const arg of args) {
  if (!allowedFlags.has(arg)) {
    console.error('Usage: node scripts/cleanup.js [--clean|--clean-all] [--force-dirty]');
    process.exit(1);
  }
}

let mode = 'dry-run';
if (args.includes('--clean-all')) {
  mode = '--clean-all';
} else if (args.includes('--clean')) {
  mode = '--clean';
}
const forceDirty = args.includes('--force-dirty');

const color = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  cyan: '\x1b[0;36m',
  reset: '\x1b[0m',
};

function paint(text, which) {
  return `${color[which]}${text}${color.reset}`;
}

if (!isSharedCheckout(repoRoot)) {
  const sharedRoot = getSharedCheckoutRoot(repoRoot);
  const rerun = `cd ${sharedRoot} && npm run cleanup${args.length > 0 ? ` -- ${args.join(' ')}` : ''}`;
  console.error(
    `${paint('ERROR', 'red')}: cleanup must run from the shared checkout, not a worktree.`,
  );
  console.error(`  Current location: ${repoRoot}`);
  console.error(`  Shared checkout:  ${sharedRoot}`);
  console.error(`  Re-run with:      ${rerun}`);
  console.error(
    '  (running from a worktree mis-computes the managed worktree root and silently reports nothing to clean.)',
  );
  process.exit(1);
}

function normalize(filePath) {
  return path
    .resolve(filePath)
    .replace(/[\\/]+$/, '')
    .toLowerCase();
}

function isManagedWorktree(filePath) {
  const target = normalize(filePath);
  const root = normalize(worktreeRoot);
  return target.startsWith(`${root}${path.sep}`) || target === root;
}

function listManagedDirs() {
  if (!fs.existsSync(worktreeRoot)) {
    return [];
  }

  return fs
    .readdirSync(worktreeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(worktreeRoot, entry.name));
}

function parseWorktreeList() {
  const result = runCommand('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot });
  if (result.status !== 0) {
    return [];
  }

  const blocks = result.stdout
    .trim()
    .split(/\r?\n\r?\n/)
    .filter(Boolean);
  return blocks
    .map((block) => {
      const item = {};
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('worktree ')) {
          item.path = line.slice('worktree '.length).trim();
        } else if (line.startsWith('branch ')) {
          item.branch = line
            .slice('branch '.length)
            .trim()
            .replace(/^refs\/heads\//, '');
        } else if (line.startsWith('HEAD ')) {
          item.head = line.slice('HEAD '.length).trim();
        } else if (line === 'bare') {
          item.bare = true;
        } else if (line === 'detached') {
          item.detached = true;
        }
      }
      return item;
    })
    .filter((item) => item.path);
}

function commandSucceeded(command, args, cwd = repoRoot) {
  return runCommand(command, args, { cwd }).status === 0;
}

function getRangeCount(range) {
  const result = runCommand('git', ['rev-list', '--count', range], { cwd: repoRoot });
  if (result.status !== 0) {
    return 0;
  }
  return Number.parseInt(result.stdout.trim(), 10) || 0;
}

function getStatusLines(cwd) {
  const result = runCommand('git', ['status', '--short'], { cwd });
  return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
}

function formatCountLines(lines, limit) {
  const shown = lines.slice(0, limit);
  for (const line of shown) {
    console.log(`    ${line}`);
  }
  if (lines.length > limit) {
    console.log(`    ... and ${lines.length - limit} more`);
  }
}

function removeDirIfExists(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function getBranchTrackingRemote(branch) {
  const result = runCommand('git', ['config', '--get', `branch.${branch}.remote`], {
    cwd: repoRoot,
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function parseLocalBranches() {
  const result = runCommand(
    'git',
    [
      'for-each-ref',
      'refs/heads',
      '--format=%(refname:short)%09%(upstream:short)%09%(upstream:track)',
    ],
    { cwd: repoRoot },
  );
  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [name, upstream, track] = line.split('\t');
      return {
        name,
        upstream: upstream || '',
        track: track || '',
      };
    })
    .filter((branch) => branch.name);
}

function compareMtime(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) {
    return null;
  }
  return fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs;
}

console.log(paint('=== Governada Workspace Cleanup ===', 'cyan'));
console.log(`Repo root: ${repoRoot}`);
console.log(`Managed worktree root: ${worktreeRoot}`);
console.log(`Mode: ${mode}`);
console.log('');

console.log(paint('[1/8] Pruning git worktree metadata...', 'cyan'));
runCommand('git', ['worktree', 'prune'], { cwd: repoRoot });
console.log('  Done.');
console.log('');

console.log(paint('[2/8] Scanning for orphaned managed worktree directories...', 'cyan'));
const orphaned = [];
for (const dir of listManagedDirs()) {
  const gitPath = path.join(dir, '.git');
  if (!fs.existsSync(gitPath)) {
    orphaned.push(dir);
    console.log(
      `  ${paint('ORPHANED', 'red')}: ${path.basename(dir)} (no .git -- leftover from removed worktree)`,
    );
  }
}
if (orphaned.length === 0) {
  console.log(`  ${paint('None found.', 'green')}`);
}
console.log('');

console.log(paint('[3/8] Checking worktrees for merged branches...', 'cyan'));
runCommand('git', ['fetch', 'origin', '--quiet'], { cwd: repoRoot });

const mergedWorktrees = [];
const staleWorktrees = [];
const activeWorktrees = [];
const externalWorktrees = [];

for (const worktree of parseWorktreeList()) {
  const worktreePath = path.resolve(worktree.path);
  const worktreeName = path.basename(worktreePath);
  const branch = worktree.branch || '(detached)';

  if (normalize(worktreePath) === normalize(repoRoot)) {
    continue;
  }

  if (!isManagedWorktree(worktreePath)) {
    console.log(
      `  ${paint('EXTERNAL', 'yellow')}: ${worktreeName} (${branch} -- outside .claude/worktrees; clean manually if needed)`,
    );
    externalWorktrees.push(worktreePath);
    continue;
  }

  if (
    !worktree.branch ||
    !commandSucceeded('git', ['rev-parse', `origin/${worktree.branch}`], repoRoot)
  ) {
    console.log(
      `  ${paint('NO REMOTE', 'yellow')}: ${worktreeName} (${branch} -- no remote branch)`,
    );
    staleWorktrees.push(worktreePath);
    continue;
  }

  const ahead = getRangeCount(`origin/main..origin/${worktree.branch}`);
  const behind = getRangeCount(`origin/${worktree.branch}..origin/main`);

  if (ahead === 0) {
    console.log(
      `  ${paint('MERGED', 'green')}: ${worktreeName} (${worktree.branch} -- 0 ahead, ${behind} behind)`,
    );
    mergedWorktrees.push(worktreePath);
  } else if (behind > 20) {
    console.log(
      `  ${paint('STALE', 'yellow')}: ${worktreeName} (${worktree.branch} -- ${ahead} ahead, ${behind} behind main)`,
    );
    staleWorktrees.push(worktreePath);
  } else {
    console.log(
      `  ${paint('ACTIVE', 'green')}: ${worktreeName} (${worktree.branch} -- ${ahead} ahead, ${behind} behind)`,
    );
    activeWorktrees.push(worktreePath);
  }
}
console.log('');

console.log(paint('[4/8] Checking for uncommitted changes...', 'cyan'));
for (const worktree of parseWorktreeList()) {
  const worktreePath = path.resolve(worktree.path);
  const worktreeName = path.basename(worktreePath);
  const lines = getStatusLines(worktreePath);
  if (lines.length === 0) {
    continue;
  }
  console.log(
    `  ${paint(worktreeName, 'yellow')}${isManagedWorktree(worktreePath) ? ':' : ' [external]:'}`,
  );
  formatCountLines(lines, 5);
}
console.log('');

console.log(paint('[5/8] Checking for stale files in managed worktree root...', 'cyan'));
const staleFiles = [];
if (fs.existsSync(worktreeRoot)) {
  for (const entry of fs.readdirSync(worktreeRoot, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!/\.(zip|bak)$/.test(entry.name) && !entry.name.endsWith('.tar.gz')) {
      continue;
    }
    const fullPath = path.join(worktreeRoot, entry.name);
    staleFiles.push(fullPath);
    const sizeKb = Math.max(1, Math.ceil(fs.statSync(fullPath).size / 1024));
    console.log(`  ${paint('STALE FILE', 'yellow')}: ${entry.name} (${sizeKb} KB)`);
  }
}
if (staleFiles.length === 0) {
  console.log(`  ${paint('None found.', 'green')}`);
}
console.log('');

console.log(paint('[6/8] Build manifest sync check...', 'cyan'));
const vision = path.join(repoRoot, 'docs', 'strategy', 'ultimate-vision.md');
const manifest = path.join(repoRoot, 'docs', 'strategy', 'context', 'build-manifest.md');
if (fs.existsSync(manifest) && fs.existsSync(vision)) {
  const delta = compareMtime(vision, manifest);
  if (delta !== null && delta > 0) {
    console.log(
      `  ${paint('STALE', 'yellow')}: build-manifest.md is older than ultimate-vision.md -- consider updating`,
    );
  } else {
    console.log(`  ${paint('IN SYNC', 'green')}: build-manifest.md is up to date`);
  }
} else if (!fs.existsSync(manifest)) {
  console.log(`  ${paint('MISSING', 'yellow')}: docs/strategy/context/build-manifest.md not found`);
}
console.log('');

console.log(paint('[7/8] Checking for stale local branches...', 'cyan'));
runCommand('git', ['fetch', '--prune', '--quiet'], { cwd: repoRoot });

const goneBranches = [];
const localOnlyBranches = [];
for (const branch of parseLocalBranches()) {
  if (branch.name === 'main' || branch.name === 'master') {
    continue;
  }

  if (branch.track.includes('[gone]')) {
    goneBranches.push(branch.name);
  } else if (!branch.upstream && !getBranchTrackingRemote(branch.name)) {
    localOnlyBranches.push(branch.name);
  }
}

goneBranches.sort();
localOnlyBranches.sort();

if (goneBranches.length > 0) {
  console.log(
    `  ${paint(`${goneBranches.length} branches with deleted remote`, 'yellow')} (squash-merged or remote-deleted)`,
  );
  for (const branch of goneBranches.slice(0, 10)) {
    console.log(`    ${paint('GONE', 'yellow')}: ${branch}`);
  }
  if (goneBranches.length > 10) {
    console.log(`    ... and ${goneBranches.length - 10} more`);
  }
} else {
  console.log(`  ${paint('No stale branches.', 'green')}`);
}

if (localOnlyBranches.length > 0) {
  console.log(
    `  ${paint(`${localOnlyBranches.length} local-only branches`, 'yellow')} (never pushed or tracking removed)`,
  );
  for (const branch of localOnlyBranches.slice(0, 5)) {
    console.log(`    ${paint('LOCAL', 'yellow')}: ${branch}`);
  }
  if (localOnlyBranches.length > 5) {
    console.log(`    ... and ${localOnlyBranches.length - 5} more`);
  }
} else {
  console.log(`  ${paint('No local-only branches.', 'green')}`);
}
console.log('');

console.log(paint('[8/8] Checking for stale stashes...', 'cyan'));
const stashResult = runCommand('git', ['stash', 'list'], { cwd: repoRoot });
const stashes = stashResult.status === 0 ? stashResult.stdout.split(/\r?\n/).filter(Boolean) : [];
if (stashes.length > 0) {
  console.log(`  ${paint(`${stashes.length} stash(es) found`, 'yellow')}`);
  formatCountLines(stashes, 5);
} else {
  console.log(`  ${paint('No stashes.', 'green')}`);
}
console.log('');

console.log(paint('=== Summary ===', 'cyan'));
console.log(`  Orphaned dirs:       ${orphaned.length}`);
console.log(`  Merged worktrees:    ${mergedWorktrees.length}`);
console.log(`  Stale worktrees:     ${staleWorktrees.length}`);
console.log(`  Active worktrees:    ${activeWorktrees.length}`);
console.log(`  External worktrees:  ${externalWorktrees.length}`);
console.log(`  Stale files:         ${staleFiles.length}`);
console.log(`  Gone branches:       ${goneBranches.length}`);
console.log(`  Local-only branches: ${localOnlyBranches.length}`);
console.log(`  Stashes:             ${stashes.length}`);
console.log('');

if (mode === '--clean' || mode === '--clean-all') {
  console.log(paint('=== Cleaning ===', 'cyan'));

  const skippedDirty = [];
  for (const worktreePath of [...mergedWorktrees, ...staleWorktrees]) {
    const label = mergedWorktrees.includes(worktreePath) ? 'merged' : 'stale';
    const worktreeName = path.basename(worktreePath);
    const dirtyLines = getStatusLines(worktreePath);

    if (dirtyLines.length > 0 && !forceDirty) {
      console.log(
        `  ${paint('SKIPPED (dirty)', 'yellow')} ${label} worktree: ${worktreeName} (${dirtyLines.length} uncommitted/untracked change(s))`,
      );
      formatCountLines(dirtyLines, 3);
      skippedDirty.push(worktreePath);
      continue;
    }

    console.log(
      `  Removing ${label} worktree: ${paint(worktreeName, label === 'merged' ? 'green' : 'yellow')}`,
    );
    removeDirIfExists(path.join(worktreePath, 'node_modules'));
    const removeArgs = ['worktree', 'remove', worktreePath];
    if (forceDirty) {
      removeArgs.push('--force');
    }
    runCommand('git', removeArgs, { cwd: repoRoot });
  }

  if (skippedDirty.length > 0) {
    console.log('');
    console.log(
      paint(
        `Skipped ${skippedDirty.length} dirty worktree(s). Resolve the changes or pass --force-dirty to remove anyway (uncommitted work will be lost).`,
        'yellow',
      ),
    );
  }

  if (mode === '--clean-all') {
    for (const dir of orphaned) {
      console.log(`  Removing orphaned dir: ${paint(path.basename(dir), 'red')}`);
      removeDirIfExists(dir);
    }
  }

  if (goneBranches.length > 0) {
    console.log('');
    console.log(`  Deleting ${goneBranches.length} branches with gone remotes...`);
    let deleted = 0;
    let failed = 0;
    for (const branch of goneBranches) {
      if (commandSucceeded('git', ['branch', '-D', branch], repoRoot)) {
        deleted += 1;
      } else {
        failed += 1;
        console.log(
          `    ${paint('FAILED', 'red')}: ${branch} (may be current branch or have unmerged work)`,
        );
      }
    }
    console.log(`    Deleted: ${paint(String(deleted), 'green')}, Failed: ${failed}`);
  }

  runCommand('git', ['worktree', 'prune'], { cwd: repoRoot });

  if (externalWorktrees.length > 0) {
    console.log('');
    console.log(paint('External worktrees were reported but not removed.', 'yellow'));
    console.log('Clean them manually from a parent writable root if you still need them gone.');
  }

  console.log('');
  console.log(paint('Cleanup complete.', 'green'));
} else {
  const totalIssues =
    orphaned.length +
    mergedWorktrees.length +
    staleWorktrees.length +
    externalWorktrees.length +
    staleFiles.length +
    goneBranches.length;

  if (totalIssues > 0) {
    console.log(
      'Run `npm run cleanup:clean` to remove merged/stale managed worktrees and prune branches.',
    );
    console.log('Run `npm run cleanup:clean-all` to also remove orphaned managed directories.');
    if (externalWorktrees.length > 0) {
      console.log('External worktrees are reported only and must be cleaned manually.');
    }
  } else {
    console.log(paint('Workspace is clean!', 'green'));
  }
}
