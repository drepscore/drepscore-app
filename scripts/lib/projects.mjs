// Pure helpers for the Phase B1b GitHub Project v2 layer. The Project itself
// is created and configured in the UI (one-time); agent tooling reads and
// updates items via the governed `gh project` lane.
//
// See scripts/project.mjs (CLI) and brain/plans/horizon-2-backlog-and-merge-policy.md.

export const DEFAULT_PROJECT_OWNER = 'governada';
export const STATUS_FIELD_NAME = 'Status';

// `gh project item-list --format json` returns items with custom-field values
// as top-level keys named after the field (e.g. item.Status, item.Priority).

// Map<statusName, item[]> from a flat items array.
export function groupItemsByStatus(items, statusFieldName = STATUS_FIELD_NAME) {
  const groups = new Map();
  for (const item of items || []) {
    const status = (item && item[statusFieldName]) ?? '(no status)';
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status).push(item);
  }
  return groups;
}

// Find a field by name in a field-list response.
export function findFieldByName(fields, name) {
  return (fields || []).find((field) => field?.name === name) ?? null;
}

// Find an option by name within a single-select field.
export function findOptionByName(field, name) {
  const options = field?.options;
  if (!Array.isArray(options)) {
    return null;
  }
  return options.find((option) => option?.name === name) ?? null;
}

// Find an item by its linked issue number (from item.content.number).
export function findItemByIssueNumber(items, issueNumber) {
  const target = Number(issueNumber);
  if (!Number.isFinite(target)) {
    return null;
  }
  return (items || []).find((item) => Number(item?.content?.number) === target) ?? null;
}

// Filter items to those whose Status value matches statusName.
export function filterItemsByStatus(items, statusName, statusFieldName = STATUS_FIELD_NAME) {
  return (items || []).filter((item) => item && item[statusFieldName] === statusName);
}
