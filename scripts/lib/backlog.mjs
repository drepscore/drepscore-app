// Backlog interface for the risk-tiered agentic workflow (Phase B1a of
// Horizon 2, brain/plans/horizon-2-backlog-and-merge-policy.md). The backlog
// is GitHub Issues filtered + sorted by label conventions:
//
//   priority/p0  highest (drop everything)
//   priority/p1  next up
//   priority/p2  default
//   priority/p3  whenever
//   status/in-progress     claimed by an agent
//   risk-tier/{low,standard,high}  hint for the B4 classifier (not consumed yet)
//
// Agent access goes through this thin interface (listOpen / nextItem / view /
// claim / release) so a future swap to another store (Linear, Supabase queue)
// is a one-module reimplementation, not a codebase-wide change.

export const PRIORITY_LABELS = Object.freeze([
  'priority/p0',
  'priority/p1',
  'priority/p2',
  'priority/p3',
]);

export const IN_PROGRESS_LABEL = 'status/in-progress';

export const RISK_TIER_LABELS = Object.freeze([
  'risk-tier/low',
  'risk-tier/standard',
  'risk-tier/high',
]);

export const DEFAULT_REPO = 'governada/app';

const PRIORITY_INDEX = new Map(PRIORITY_LABELS.map((name, index) => [name, index]));

function labelNames(labels) {
  if (!Array.isArray(labels)) {
    return [];
  }
  return labels
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter((name) => typeof name === 'string' && name.length > 0);
}

// Return 0-3 for the highest priority label present (p0 = 0, p3 = 3), or null
// if none is set. If multiple priority labels are set (a labelling-discipline
// issue, but possible), the highest priority wins.
export function extractPriority(labels) {
  let best = null;
  for (const name of labelNames(labels)) {
    const index = PRIORITY_INDEX.get(name);
    if (typeof index === 'number' && (best === null || index < best)) {
      best = index;
    }
  }
  return best;
}

export function hasInProgressLabel(labels) {
  return labelNames(labels).includes(IN_PROGRESS_LABEL);
}

// Sort by (priority ascending, issue number ascending). Issues without a
// priority label sort last; older issue numbers break ties.
export function sortByPriority(issues) {
  return [...issues].sort((a, b) => {
    const pa = extractPriority(a?.labels) ?? Number.POSITIVE_INFINITY;
    const pb = extractPriority(b?.labels) ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) {
      return pa - pb;
    }
    const na = Number(a?.number ?? 0);
    const nb = Number(b?.number ?? 0);
    return na - nb;
  });
}

// Factory. Pass a `runGh` adapter for testability — `runGh(args)` must resolve
// to parsed JSON when `args` includes `--json`, or the raw string otherwise.
export function createGitHubBacklog({ runGh, repo = DEFAULT_REPO } = {}) {
  if (typeof runGh !== 'function') {
    throw new Error('createGitHubBacklog requires a runGh adapter.');
  }

  async function listOpen({ includeInProgress = false } = {}) {
    const result = await runGh([
      'issue',
      'list',
      '--repo',
      repo,
      '--state',
      'open',
      '--json',
      'number,title,labels,url',
      '--limit',
      '200',
    ]);
    const issues = Array.isArray(result) ? result : [];
    if (includeInProgress) {
      return issues;
    }
    return issues.filter((issue) => !hasInProgressLabel(issue?.labels));
  }

  async function nextItem() {
    const open = await listOpen();
    const sorted = sortByPriority(open);
    return sorted[0] ?? null;
  }

  async function view(issueNumber) {
    return runGh([
      'issue',
      'view',
      String(issueNumber),
      '--repo',
      repo,
      '--json',
      'number,title,body,labels,url,state',
    ]);
  }

  async function claim(issueNumber) {
    return runGh([
      'issue',
      'edit',
      String(issueNumber),
      '--repo',
      repo,
      '--add-label',
      IN_PROGRESS_LABEL,
    ]);
  }

  async function release(issueNumber) {
    return runGh([
      'issue',
      'edit',
      String(issueNumber),
      '--repo',
      repo,
      '--remove-label',
      IN_PROGRESS_LABEL,
    ]);
  }

  return { listOpen, nextItem, view, claim, release };
}
