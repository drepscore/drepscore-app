import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('peer review CLI default', () => {
  it('uses current Codex CLI flags for the default review command', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/peer-review.mjs'), 'utf8');

    expect(source).toContain('codex exec --sandbox read-only --ephemeral -');
    expect(source).toContain("'--ephemeral'");
    expect(source).not.toContain('--ask-for-approval');
  });
});
