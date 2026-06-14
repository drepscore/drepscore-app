import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('dev doctor wiring', () => {
  it('exposes a dev:doctor npm script', () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(packageJson.scripts['dev:doctor']).toBe('node scripts/dev-doctor.mjs');
  });

  it('checks the local development friction points without resolving secrets', () => {
    const scriptPath = path.join(repoRoot, 'scripts/dev-doctor.mjs');
    expect(existsSync(scriptPath)).toBe(true);

    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain('Dev doctor: Governada local development readiness');
    expect(source).toContain('isNodeVersionSupported');
    expect(source).toContain('findEnvRefsFile');
    expect(source).toContain('core.hooksPath');
    expect(source).toContain('OrbStack/Docker');
    expect(source).toContain('staging-backed');
    expect(source).not.toContain('resolveOpRef');
    expect(source).not.toContain('SUPABASE_SECRET_KEY');
  });
});
