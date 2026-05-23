import { describe, expect, it } from 'vitest';
import {
  BACKLOG_LABEL_DEFS,
  buildIssueSpec,
  classifyPriority,
  filterUnseeded,
  normalizeTitle,
  parseManifest,
} from '@/scripts/lib/seed-backlog.mjs';

describe('classifyPriority', () => {
  it('should map Phase 1 to priority/p1', () => {
    expect(classifyPriority('Phase 1 Remaining')).toBe('priority/p1');
  });

  it('should map Phase 2 to priority/p2', () => {
    expect(classifyPriority('Phase 2 Not Started: Living Platform')).toBe('priority/p2');
  });

  it('should map Phase 3 to priority/p2', () => {
    expect(classifyPriority('Phase 3 Not Started: Growth Engine')).toBe('priority/p2');
  });

  it('should map Post-Launch to priority/p3', () => {
    expect(classifyPriority('Post-Launch')).toBe('priority/p3');
    expect(classifyPriority('Post launch')).toBe('priority/p3');
  });

  it('should default to priority/p2 for unknown sections', () => {
    expect(classifyPriority('Random heading')).toBe('priority/p2');
    expect(classifyPriority('')).toBe('priority/p2');
  });
});

describe('parseManifest', () => {
  const SAMPLE = [
    '# Manifest',
    '',
    '## Shipped',
    '',
    '- [x] DRep Score V3.',
    '- [x] SPO scoring.',
    '',
    '## Not Shipped',
    '',
    '### Phase 1 Remaining',
    '',
    '- [ ] /you/inbox notification pipeline.',
    '- [ ] Dual-role sidebar.',
    '',
    '### Phase 2 Not Started: Living Platform',
    '',
    '- [ ] Hub engagement prompts.',
    '',
    '### Post-Launch',
    '',
    '- [ ] Stripe billing.',
    '',
    '## Launch Posture',
    '',
    'Some prose, not an item.',
    '',
  ].join('\n');

  it('should extract only "Not Shipped" checkbox items', () => {
    const items = parseManifest(SAMPLE);
    expect(items.map((item) => item.title)).toEqual([
      '/you/inbox notification pipeline.',
      'Dual-role sidebar.',
      'Hub engagement prompts.',
      'Stripe billing.',
    ]);
  });

  it('should attach section heading and priority label to each item', () => {
    const items = parseManifest(SAMPLE);
    expect(items[0]?.sectionHeading).toBe('Phase 1 Remaining');
    expect(items[0]?.priorityLabel).toBe('priority/p1');
    expect(items[2]?.sectionHeading).toBe('Phase 2 Not Started: Living Platform');
    expect(items[2]?.priorityLabel).toBe('priority/p2');
    expect(items[3]?.sectionHeading).toBe('Post-Launch');
    expect(items[3]?.priorityLabel).toBe('priority/p3');
  });

  it('should ignore checked (shipped) items', () => {
    const items = parseManifest(SAMPLE);
    expect(items.find((item) => item.title.includes('DRep Score'))).toBeUndefined();
  });

  it('should return an empty array when no "Not Shipped" section exists', () => {
    expect(parseManifest('# Just a heading\n')).toEqual([]);
  });

  it('should stop at the next H2 boundary', () => {
    const items = parseManifest(SAMPLE);
    expect(items.find((item) => item.title.includes('Launch Posture'))).toBeUndefined();
  });
});

describe('buildIssueSpec', () => {
  it('should produce title, body, and labels from a manifest item', () => {
    const item = {
      title: 'My item',
      sectionHeading: 'Phase 1 Remaining',
      priorityLabel: 'priority/p1',
    };
    const spec = buildIssueSpec(item);
    expect(spec.title).toBe('My item');
    expect(spec.labels).toEqual(['priority/p1']);
    expect(spec.body).toContain('docs/manifest.md');
    expect(spec.body).toContain('Phase 1 Remaining');
  });

  it('should fall back to "(unknown section)" when section is missing', () => {
    const spec = buildIssueSpec({
      title: 'x',
      sectionHeading: '',
      priorityLabel: 'priority/p2',
    });
    expect(spec.body).toContain('(unknown section)');
  });
});

describe('normalizeTitle', () => {
  it('should lowercase and collapse whitespace', () => {
    expect(normalizeTitle('Foo  BAR')).toBe('foo bar');
    expect(normalizeTitle('  spaces  ')).toBe('spaces');
  });

  it('should tolerate missing input', () => {
    expect(normalizeTitle(undefined)).toBe('');
    expect(normalizeTitle(null)).toBe('');
  });
});

describe('filterUnseeded', () => {
  it('should skip specs whose title already exists (normalized)', () => {
    const specs = [{ title: 'Foo' }, { title: 'Bar' }, { title: 'Baz' }];
    const filtered = filterUnseeded(specs, ['bar', 'Quux']);
    expect(filtered.map((spec: { title: string }) => spec.title)).toEqual(['Foo', 'Baz']);
  });

  it('should match case- and whitespace-insensitively', () => {
    const specs = [{ title: 'Foo  Bar' }];
    expect(filterUnseeded(specs, ['FOO BAR'])).toEqual([]);
  });

  it('should pass everything through when the existing list is empty', () => {
    const specs = [{ title: 'A' }, { title: 'B' }];
    expect(filterUnseeded(specs, []).map((spec: { title: string }) => spec.title)).toEqual([
      'A',
      'B',
    ]);
  });
});

describe('BACKLOG_LABEL_DEFS', () => {
  it('should include priority/p0..p3, status/in-progress, and risk-tier/{low,standard,high}', () => {
    const names = BACKLOG_LABEL_DEFS.map((def) => def.name).sort();
    expect(names).toEqual([
      'priority/p0',
      'priority/p1',
      'priority/p2',
      'priority/p3',
      'risk-tier/high',
      'risk-tier/low',
      'risk-tier/standard',
      'status/in-progress',
    ]);
  });

  it('should provide a 6-hex color and a non-empty description for each label', () => {
    for (const def of BACKLOG_LABEL_DEFS) {
      expect(def.color).toMatch(/^[0-9A-F]{6}$/iu);
      expect(def.description).toBeTruthy();
    }
  });
});
