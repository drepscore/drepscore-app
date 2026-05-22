import { describe, expect, it } from 'vitest';
import {
  isGitHubLaneKey,
  isOpReference,
  parseEnvEntries,
  planInjection,
  stripOpRefSuffix,
} from '@/scripts/lib/env-bootstrap.mjs';

describe('parseEnvEntries', () => {
  it('should parse key=value pairs into ordered entries', () => {
    expect(parseEnvEntries('A=1\nB=2')).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ]);
  });

  it('should skip blank lines and comment lines', () => {
    expect(parseEnvEntries('# comment\n\nA=1\n   \n# another')).toEqual([{ key: 'A', value: '1' }]);
  });

  it('should strip an optional export prefix', () => {
    expect(parseEnvEntries('export A=1')).toEqual([{ key: 'A', value: '1' }]);
  });

  it('should strip surrounding single and double quotes', () => {
    expect(parseEnvEntries('A="quoted"\nB=\'single\'')).toEqual([
      { key: 'A', value: 'quoted' },
      { key: 'B', value: 'single' },
    ]);
  });

  it('should strip a trailing inline comment from an unquoted value', () => {
    expect(parseEnvEntries('A=value # trailing')).toEqual([{ key: 'A', value: 'value' }]);
  });

  it('should keep a # inside a quoted value', () => {
    expect(parseEnvEntries('A="a # b"')).toEqual([{ key: 'A', value: 'a # b' }]);
  });

  it('should preserve an op:// reference value verbatim', () => {
    expect(parseEnvEntries('K_OP_REF=op://Vault/item/field')).toEqual([
      { key: 'K_OP_REF', value: 'op://Vault/item/field' },
    ]);
  });

  it('should ignore lines without an = separator', () => {
    expect(parseEnvEntries('not-an-assignment\nA=1')).toEqual([{ key: 'A', value: '1' }]);
  });
});

describe('isOpReference', () => {
  it('should be true for an op:// value', () => {
    expect(isOpReference('op://Vault/item/field')).toBe(true);
  });

  it('should be false for plain literals and empty values', () => {
    expect(isOpReference('true')).toBe(false);
    expect(isOpReference('')).toBe(false);
  });
});

describe('stripOpRefSuffix', () => {
  it('should remove a trailing _OP_REF', () => {
    expect(stripOpRefSuffix('SESSION_SECRET_OP_REF')).toBe('SESSION_SECRET');
  });

  it('should leave a key without the suffix unchanged', () => {
    expect(stripOpRefSuffix('DEV_MOCK_AUTH')).toBe('DEV_MOCK_AUTH');
  });

  it('should only strip a true suffix, not an interior match', () => {
    expect(stripOpRefSuffix('OP_REF_NAME')).toBe('OP_REF_NAME');
  });
});

describe('isGitHubLaneKey', () => {
  it('should flag GitHub App credential keys', () => {
    expect(isGitHubLaneKey('GOVERNADA_GITHUB_CLIENT_ID_OP_REF')).toBe(true);
    expect(isGitHubLaneKey('GOVERNADA_GITHUB_APP_PRIVATE_KEY_ROTATE_AFTER')).toBe(true);
  });

  it('should flag raw GitHub token keys', () => {
    expect(isGitHubLaneKey('GH_TOKEN_OP_REF')).toBe(true);
    expect(isGitHubLaneKey('GITHUB_TOKEN')).toBe(true);
  });

  it('should not flag application runtime keys', () => {
    expect(isGitHubLaneKey('NEXT_PUBLIC_SUPABASE_URL_OP_REF')).toBe(false);
    expect(isGitHubLaneKey('SESSION_SECRET_OP_REF')).toBe(false);
    expect(isGitHubLaneKey('DEV_MOCK_AUTH')).toBe(false);
  });
});

describe('planInjection', () => {
  it('should classify references, literals, and skipped GitHub-lane keys', () => {
    const plan = planInjection([
      {
        key: 'NEXT_PUBLIC_SUPABASE_URL_OP_REF',
        value: 'op://Vault/staging/NEXT_PUBLIC_SUPABASE_URL',
      },
      { key: 'DEV_MOCK_AUTH', value: 'true' },
      { key: 'GOVERNADA_GITHUB_CLIENT_ID_OP_REF', value: 'op://Vault/app/client_id' },
    ]);

    expect(plan.refs).toEqual([
      {
        sourceKey: 'NEXT_PUBLIC_SUPABASE_URL_OP_REF',
        envKey: 'NEXT_PUBLIC_SUPABASE_URL',
        opRef: 'op://Vault/staging/NEXT_PUBLIC_SUPABASE_URL',
      },
    ]);
    expect(plan.literals).toEqual([
      { sourceKey: 'DEV_MOCK_AUTH', envKey: 'DEV_MOCK_AUTH', value: 'true' },
    ]);
    expect(plan.skipped).toEqual(['GOVERNADA_GITHUB_CLIENT_ID_OP_REF']);
  });

  it('should never route a GitHub-lane key into refs or literals', () => {
    const plan = planInjection([{ key: 'GH_TOKEN_OP_REF', value: 'op://Vault/human/token' }]);

    expect(plan.refs).toEqual([]);
    expect(plan.literals).toEqual([]);
    expect(plan.skipped).toEqual(['GH_TOKEN_OP_REF']);
  });

  it('should strip the _OP_REF suffix for the injected env key', () => {
    const plan = planInjection([
      { key: 'SESSION_SECRET_OP_REF', value: 'op://Vault/staging/SESSION_SECRET' },
    ]);

    expect(plan.refs[0]?.envKey).toBe('SESSION_SECRET');
  });
});
