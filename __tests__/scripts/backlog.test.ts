import { describe, expect, it, vi } from 'vitest';
import {
  createGitHubBacklog,
  extractPriority,
  hasInProgressLabel,
  IN_PROGRESS_LABEL,
  PRIORITY_LABELS,
  sortByPriority,
} from '@/scripts/lib/backlog.mjs';

function lbl(...names: string[]) {
  return names.map((name) => ({ name }));
}

describe('extractPriority', () => {
  it('should return the index for a priority label', () => {
    expect(extractPriority(lbl('priority/p0'))).toBe(0);
    expect(extractPriority(lbl('priority/p2'))).toBe(2);
    expect(extractPriority(lbl('priority/p3'))).toBe(3);
  });

  it('should return null when no priority label is present', () => {
    expect(extractPriority(lbl('bug'))).toBeNull();
    expect(extractPriority([])).toBeNull();
  });

  it('should accept labels as plain strings', () => {
    expect(extractPriority(['priority/p1'])).toBe(1);
  });

  it('should pick the highest priority when multiple are set', () => {
    expect(extractPriority(lbl('priority/p2', 'priority/p0'))).toBe(0);
    expect(extractPriority(lbl('priority/p3', 'priority/p1', 'priority/p2'))).toBe(1);
  });

  it('should ignore non-priority labels in the mix', () => {
    expect(extractPriority(lbl('bug', 'priority/p2', 'good-first-issue'))).toBe(2);
  });
});

describe('hasInProgressLabel', () => {
  it('should detect the in-progress label', () => {
    expect(hasInProgressLabel(lbl('status/in-progress'))).toBe(true);
    expect(hasInProgressLabel(lbl('priority/p1', 'status/in-progress'))).toBe(true);
  });

  it('should be false when absent', () => {
    expect(hasInProgressLabel(lbl('priority/p1'))).toBe(false);
    expect(hasInProgressLabel([])).toBe(false);
  });
});

describe('sortByPriority', () => {
  it('should sort by priority ascending then by issue number ascending', () => {
    const issues = [
      { number: 5, title: 'p2 #5', labels: lbl('priority/p2') },
      { number: 3, title: 'p0 #3', labels: lbl('priority/p0') },
      { number: 9, title: 'no priority', labels: lbl('bug') },
      { number: 7, title: 'p0 #7', labels: lbl('priority/p0') },
    ];
    const sorted = sortByPriority(issues);
    expect(sorted.map((i) => i.number)).toEqual([3, 7, 5, 9]);
  });

  it('should not mutate the input array', () => {
    const issues = [
      { number: 2, labels: lbl('priority/p2') },
      { number: 1, labels: lbl('priority/p0') },
    ];
    const before = issues.map((i) => i.number);
    sortByPriority(issues);
    expect(issues.map((i) => i.number)).toEqual(before);
  });
});

describe('createGitHubBacklog', () => {
  it('should require a runGh adapter', () => {
    expect(() => createGitHubBacklog({})).toThrow(/runGh adapter/);
  });

  it('listOpen should filter out in-progress issues by default', async () => {
    const runGh = vi.fn().mockResolvedValue([
      { number: 1, title: 'a', labels: lbl('priority/p0') },
      { number: 2, title: 'b', labels: lbl('priority/p1', 'status/in-progress') },
      { number: 3, title: 'c', labels: lbl('priority/p2') },
    ]);
    const backlog = createGitHubBacklog({ runGh, repo: 'foo/bar' });
    const open = await backlog.listOpen();
    expect(open.map((i) => i.number)).toEqual([1, 3]);
  });

  it('listOpen({ includeInProgress: true }) should include in-progress issues', async () => {
    const runGh = vi.fn().mockResolvedValue([
      { number: 1, labels: lbl('priority/p0') },
      { number: 2, labels: lbl('status/in-progress') },
    ]);
    const backlog = createGitHubBacklog({ runGh, repo: 'foo/bar' });
    const all = await backlog.listOpen({ includeInProgress: true });
    expect(all.map((i) => i.number)).toEqual([1, 2]);
  });

  it('listOpen should call gh issue list scoped to the configured repo', async () => {
    const runGh = vi.fn().mockResolvedValue([]);
    const backlog = createGitHubBacklog({ runGh, repo: 'my-org/my-repo' });
    await backlog.listOpen();
    expect(runGh).toHaveBeenCalledTimes(1);
    const args = runGh.mock.calls[0]?.[0] as string[];
    expect(args.slice(0, 5)).toEqual(['issue', 'list', '--repo', 'my-org/my-repo', '--state']);
    expect(args).toContain('--json');
    expect(args).toContain('--limit');
  });

  it('nextItem should return the highest-priority unclaimed issue', async () => {
    const runGh = vi.fn().mockResolvedValue([
      { number: 5, labels: lbl('priority/p2') },
      { number: 3, labels: lbl('priority/p0') },
      { number: 1, labels: lbl('priority/p0', 'status/in-progress') },
    ]);
    const backlog = createGitHubBacklog({ runGh });
    const next = await backlog.nextItem();
    expect(next?.number).toBe(3);
  });

  it('nextItem should return null when no unclaimed issues exist', async () => {
    const runGh = vi.fn().mockResolvedValue([{ number: 1, labels: lbl('status/in-progress') }]);
    const backlog = createGitHubBacklog({ runGh });
    expect(await backlog.nextItem()).toBeNull();
  });

  it('claim should add the in-progress label via gh issue edit', async () => {
    const runGh = vi.fn().mockResolvedValue('');
    const backlog = createGitHubBacklog({ runGh, repo: 'foo/bar' });
    await backlog.claim(42);
    expect(runGh).toHaveBeenCalledWith([
      'issue',
      'edit',
      '42',
      '--repo',
      'foo/bar',
      '--add-label',
      IN_PROGRESS_LABEL,
    ]);
  });

  it('release should remove the in-progress label via gh issue edit', async () => {
    const runGh = vi.fn().mockResolvedValue('');
    const backlog = createGitHubBacklog({ runGh, repo: 'foo/bar' });
    await backlog.release(42);
    expect(runGh).toHaveBeenCalledWith([
      'issue',
      'edit',
      '42',
      '--repo',
      'foo/bar',
      '--remove-label',
      IN_PROGRESS_LABEL,
    ]);
  });

  it('view should fetch issue details by number', async () => {
    const issue = {
      number: 7,
      title: 'x',
      body: 'desc',
      labels: [],
      url: 'https://example/x',
      state: 'OPEN',
    };
    const runGh = vi.fn().mockResolvedValue(issue);
    const backlog = createGitHubBacklog({ runGh, repo: 'foo/bar' });
    const result = await backlog.view(7);
    expect(result).toBe(issue);
    const args = runGh.mock.calls[0]?.[0] as string[];
    expect(args.slice(0, 5)).toEqual(['issue', 'view', '7', '--repo', 'foo/bar']);
    expect(args).toContain('--json');
  });
});

describe('PRIORITY_LABELS export', () => {
  it('should be in priority order from highest to lowest', () => {
    expect(PRIORITY_LABELS).toEqual(['priority/p0', 'priority/p1', 'priority/p2', 'priority/p3']);
  });
});
