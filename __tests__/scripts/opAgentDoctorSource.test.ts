import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('op agent doctor source contract', () => {
  it('allows the approved preprod item label while still blocking production and admin labels', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/op-agent-doctor.mjs'), 'utf8');

    expect(source).toContain('isForbiddenItemName');
    expect(source).toContain('governada-preprod-environment');
    expect(source).toContain('governada-production-environment');
    expect(source).toContain('governada-admin-token');
    expect(source).not.toContain("'prod',");
  });
});
