import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('env doctor source contract', () => {
  it('prints the active credential lane promised by operations docs', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/env-doctor.mjs'), 'utf8');

    expect(source).toContain('formatActiveCredentialLane');
    expect(source).toContain('Active credential lane:');
    expect(source).toContain('agent (OP_AGENT_SERVICE_ACCOUNT_TOKEN');
    expect(source).toContain('human (SSH+1Password Desktop)');
    expect(source).toContain('NONE');
  });
});
