import { describe, expect, it } from 'vitest';
import {
  classifyPrRisk,
  hasBreakingMarker,
  matchesAny,
  PR_RISK_CONSTANTS,
} from '@/scripts/lib/pr-risk.mjs';

function mkPr(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: 'docs: update readme',
    body: '',
    additions: 5,
    deletions: 2,
    files: [{ path: 'README.md', additions: 5, deletions: 2 }],
    ...overrides,
  };
}

describe('classifyPrRisk — high tier', () => {
  it('should mark a supabase migration touch as high-risk', () => {
    const result = classifyPrRisk(
      mkPr({
        files: [{ path: 'supabase/migrations/20260601_init.sql', additions: 10, deletions: 0 }],
      }),
    );
    expect(result.tier).toBe('high');
    expect(result.reasons[0]).toMatch(/high-risk paths touched/);
  });

  it('should mark a scoring engine change as high-risk', () => {
    const result = classifyPrRisk(
      mkPr({ files: [{ path: 'lib/scoring/engine.ts', additions: 3, deletions: 1 }] }),
    );
    expect(result.tier).toBe('high');
  });

  it('should mark a matching engine change as high-risk', () => {
    const result = classifyPrRisk(
      mkPr({ files: [{ path: 'lib/matching/pca.ts', additions: 3, deletions: 1 }] }),
    );
    expect(result.tier).toBe('high');
  });

  it('should mark an auth library change as high-risk', () => {
    const result = classifyPrRisk(
      mkPr({ files: [{ path: 'lib/auth.ts', additions: 3, deletions: 1 }] }),
    );
    expect(result.tier).toBe('high');
  });

  it('should mark an instrumentation change as high-risk', () => {
    const result = classifyPrRisk(
      mkPr({ files: [{ path: 'instrumentation.ts', additions: 3, deletions: 1 }] }),
    );
    expect(result.tier).toBe('high');
  });

  it('should mark a breaking-change marker in the title as high-risk', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'feat!: drop legacy API',
        files: [{ path: 'README.md', additions: 1, deletions: 0 }],
      }),
    );
    expect(result.tier).toBe('high');
  });

  it('should mark a BREAKING CHANGE in the body as high-risk', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'docs: update readme',
        body: 'BREAKING CHANGE: signature changed',
        files: [{ path: 'README.md', additions: 1, deletions: 0 }],
      }),
    );
    expect(result.tier).toBe('high');
  });
});

describe('classifyPrRisk — low tier', () => {
  it('should mark a pure docs PR as low-risk', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'docs: clarify env setup',
        files: [{ path: 'README.md', additions: 5, deletions: 2 }],
      }),
    );
    expect(result.tier).toBe('low');
  });

  it('should mark a test-only PR as low-risk', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'test: add coverage for parser',
        additions: 20,
        deletions: 0,
        files: [{ path: '__tests__/scripts/foo.test.ts', additions: 20, deletions: 0 }],
      }),
    );
    expect(result.tier).toBe('low');
  });

  it('should ignore conventional-commit type when all files are low-risk paths', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'feat: add troubleshooting section',
        additions: 30,
        deletions: 0,
        files: [{ path: 'docs/troubleshooting.md', additions: 30, deletions: 0 }],
      }),
    );
    expect(result.tier).toBe('low');
  });

  it('should mark a multi-file docs PR within bounds as low-risk', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'docs: split runbook',
        additions: 60,
        deletions: 10,
        files: [
          { path: 'docs/runbook.md', additions: 30, deletions: 10 },
          { path: 'docs/operations/sync.md', additions: 20, deletions: 0 },
          { path: 'README.md', additions: 10, deletions: 0 },
        ],
      }),
    );
    expect(result.tier).toBe('low');
  });
});

describe('classifyPrRisk — standard tier', () => {
  it('should mark a small code change in a non-high path as standard', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'fix: handle null',
        files: [{ path: 'lib/utils/format.ts', additions: 3, deletions: 1 }],
      }),
    );
    expect(result.tier).toBe('standard');
  });

  it('should mark a mixed PR (docs + code) as standard', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'chore: update docs and fix typo',
        files: [
          { path: 'README.md', additions: 2, deletions: 1 },
          { path: 'components/Button.tsx', additions: 1, deletions: 1 },
        ],
      }),
    );
    expect(result.tier).toBe('standard');
    expect(result.reasons[0]).toMatch(/paths outside low-risk allowlist/);
  });

  it('should mark too many files as standard', () => {
    const files = Array.from({ length: PR_RISK_CONSTANTS.MAX_LOW_FILES + 1 }, (_, index) => ({
      path: `docs/file-${index}.md`,
      additions: 1,
      deletions: 0,
    }));
    const result = classifyPrRisk(mkPr({ files, additions: files.length, deletions: 0 }));
    expect(result.tier).toBe('standard');
    expect(result.reasons[0]).toMatch(/files exceeds low-risk cap/);
  });

  it('should mark too many lines as standard', () => {
    const overLimit = PR_RISK_CONSTANTS.MAX_LOW_LINES + 50;
    const result = classifyPrRisk(
      mkPr({
        title: 'docs: massive rewrite',
        additions: overLimit,
        deletions: 0,
        files: [{ path: 'docs/big.md', additions: overLimit, deletions: 0 }],
      }),
    );
    expect(result.tier).toBe('standard');
    expect(result.reasons[0]).toMatch(/lines.*exceeds low-risk cap/);
  });

  it('should mark a scripts/ change as standard (agent harness needs review)', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'chore: tweak helper',
        files: [{ path: 'scripts/foo.mjs', additions: 3, deletions: 1 }],
      }),
    );
    expect(result.tier).toBe('standard');
  });

  it('should mark a workflow change as standard', () => {
    const result = classifyPrRisk(
      mkPr({
        title: 'ci: tweak workflow',
        files: [{ path: '.github/workflows/foo.yml', additions: 3, deletions: 1 }],
      }),
    );
    expect(result.tier).toBe('standard');
  });
});

describe('classifyPrRisk — edge cases', () => {
  it('should treat an empty PR as standard', () => {
    const result = classifyPrRisk(mkPr({ files: [] }));
    expect(result.tier).toBe('standard');
    expect(result.reasons[0]).toMatch(/no files in diff/);
  });

  it('should tolerate missing optional fields', () => {
    const result = classifyPrRisk({ files: [{ path: 'README.md' }] });
    expect(result.tier).toBe('low');
  });

  it('should self-classify a B4-shaped PR as standard, not low', () => {
    // The risk-tiered build itself touches scripts/, .github/workflows/,
    // __tests__/, package.json — not all low-risk paths. It must NOT
    // auto-merge itself.
    const result = classifyPrRisk(
      mkPr({
        title: 'feat(merge-policy): risk-tiered auto-merge',
        additions: 350,
        deletions: 0,
        files: [
          { path: 'scripts/lib/pr-risk.mjs', additions: 110, deletions: 0 },
          { path: 'scripts/classify-pr-risk.mjs', additions: 80, deletions: 0 },
          { path: '.github/workflows/risk-tiered-auto-merge.yml', additions: 45, deletions: 0 },
          { path: '__tests__/scripts/classifyPrRisk.test.ts', additions: 115, deletions: 0 },
          { path: 'package.json', additions: 1, deletions: 0 },
        ],
      }),
    );
    expect(result.tier).toBe('standard');
  });
});

describe('hasBreakingMarker', () => {
  it('should detect the ! suffix in a conventional-commit type', () => {
    expect(hasBreakingMarker('feat!: drop X', '')).toBe(true);
    expect(hasBreakingMarker('fix(scope)!: change Y', '')).toBe(true);
  });

  it('should detect BREAKING CHANGE in the body', () => {
    expect(hasBreakingMarker('feat: x', 'BREAKING CHANGE: signature changed')).toBe(true);
  });

  it('should not flag a normal commit', () => {
    expect(hasBreakingMarker('feat: add X', 'normal body')).toBe(false);
    expect(hasBreakingMarker('fix: y', '')).toBe(false);
  });
});

describe('matchesAny', () => {
  it('should return true when at least one pattern matches', () => {
    expect(matchesAny('docs/foo.md', [/^docs\//, /\.ts$/])).toBe(true);
  });

  it('should return false when no pattern matches', () => {
    expect(matchesAny('app/page.tsx', [/^docs\//, /\.md$/])).toBe(false);
  });
});
