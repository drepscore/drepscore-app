// Pure helpers for seeding the GitHub Issues backlog from docs/manifest.md.
// See brain/plans/horizon-2-backlog-and-merge-policy.md (Phase B1a) and the
// scripts/seed-backlog.mjs CLI.

export const BACKLOG_LABEL_DEFS = Object.freeze([
  { name: 'priority/p0', color: 'B60205', description: 'Critical — drop everything' },
  { name: 'priority/p1', color: 'D93F0B', description: 'High — next up' },
  { name: 'priority/p2', color: 'FBCA04', description: 'Medium — default' },
  { name: 'priority/p3', color: 'C5DEF5', description: 'Low — whenever' },
  { name: 'status/in-progress', color: '0E8A16', description: 'Claimed by an agent' },
  {
    name: 'status/blocked',
    color: '6F42C1',
    description: 'Blocked — needs human input or external action (HITL signal)',
  },
  {
    name: 'risk-tier/low',
    color: '0E8A16',
    description: 'Auto-merge eligible (Horizon 2 B4)',
  },
  {
    name: 'risk-tier/standard',
    color: 'FBCA04',
    description: 'Chat-approval merge (Horizon 2 B4)',
  },
  {
    name: 'risk-tier/high',
    color: 'B60205',
    description: 'Explicit review (Horizon 2 B4)',
  },
]);

// Map a manifest section heading to a priority label.
export function classifyPriority(sectionHeading) {
  const lower = String(sectionHeading || '').toLowerCase();
  if (lower.includes('phase 1')) {
    return 'priority/p1';
  }
  if (lower.includes('phase 2') || lower.includes('phase 3')) {
    return 'priority/p2';
  }
  if (lower.includes('post-launch') || lower.includes('post launch')) {
    return 'priority/p3';
  }
  return 'priority/p2';
}

// Extract `- [ ] ...` items under the "## Not Shipped" section of a manifest.
export function parseManifest(content) {
  const lines = String(content || '').split(/\r?\n/u);
  const items = [];
  let inNotShipped = false;
  let currentSection = '';

  for (const line of lines) {
    if (/^##\s+/u.test(line)) {
      inNotShipped = /^##\s+Not Shipped\b/iu.test(line);
      currentSection = '';
      continue;
    }
    if (!inNotShipped) {
      continue;
    }
    if (/^###\s+/u.test(line)) {
      currentSection = line.replace(/^###\s+/u, '').trim();
      continue;
    }

    const match = line.match(/^-\s*\[ \]\s*(.+?)\s*$/u);
    if (match) {
      const title = match[1];
      items.push({
        title,
        sectionHeading: currentSection,
        priorityLabel: classifyPriority(currentSection),
      });
    }
  }

  return items;
}

// Build a GitHub issue spec from a manifest item.
export function buildIssueSpec(item) {
  const section = item?.sectionHeading ? item.sectionHeading : '(unknown section)';
  return {
    title: String(item?.title || ''),
    body: [
      `Auto-seeded from \`docs/manifest.md\` — section: **${section}**.`,
      '',
      'Refine the description and acceptance criteria as work begins.',
    ].join('\n'),
    labels: item?.priorityLabel ? [item.priorityLabel] : [],
  };
}

export function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

// Filter specs whose title (normalized) already appears in existingTitles.
export function filterUnseeded(specs, existingTitles) {
  const existing = new Set((existingTitles || []).map(normalizeTitle));
  return (specs || []).filter((spec) => !existing.has(normalizeTitle(spec?.title)));
}
