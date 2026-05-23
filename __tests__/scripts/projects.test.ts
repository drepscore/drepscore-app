import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_OWNER,
  filterItemsByStatus,
  findFieldByName,
  findItemByIssueNumber,
  findOptionByName,
  groupItemsByStatus,
  STATUS_FIELD_KEY,
  STATUS_FIELD_NAME,
} from '@/scripts/lib/projects.mjs';

describe('exports', () => {
  it('should export stable defaults', () => {
    expect(STATUS_FIELD_NAME).toBe('Status');
    expect(STATUS_FIELD_KEY).toBe('status');
    expect(DEFAULT_PROJECT_OWNER).toBe('governada');
  });
});

describe('groupItemsByStatus', () => {
  it('should group items by their Status field value', () => {
    const items = [
      { id: 'a', status: 'Backlog' },
      { id: 'b', status: 'In progress' },
      { id: 'c', status: 'Backlog' },
      { id: 'd', status: 'Done' },
    ];
    const groups = groupItemsByStatus(items);
    expect(groups.get('Backlog')?.map((item: { id: string }) => item.id)).toEqual(['a', 'c']);
    expect(groups.get('In progress')?.map((item: { id: string }) => item.id)).toEqual(['b']);
    expect(groups.get('Done')?.map((item: { id: string }) => item.id)).toEqual(['d']);
  });

  it('should place items without a Status under "(no status)"', () => {
    const items = [{ id: 'a' }, { id: 'b', status: 'Done' }];
    const groups = groupItemsByStatus(items);
    expect(groups.get('(no status)')?.map((item: { id: string }) => item.id)).toEqual(['a']);
    expect(groups.get('Done')?.map((item: { id: string }) => item.id)).toEqual(['b']);
  });

  it('should return an empty map for empty or nullish input', () => {
    expect(groupItemsByStatus([]).size).toBe(0);
    expect(groupItemsByStatus(null).size).toBe(0);
    expect(groupItemsByStatus(undefined).size).toBe(0);
  });

  it('should accept a custom status field key', () => {
    const items = [{ id: 'a', priority: 'P1' }];
    const groups = groupItemsByStatus(items, 'priority');
    expect(groups.get('P1')?.map((item: { id: string }) => item.id)).toEqual(['a']);
  });
});

describe('findFieldByName', () => {
  it('should find a field by name', () => {
    const fields = [
      { id: 'f1', name: 'Title' },
      { id: 'f2', name: 'Status' },
    ];
    expect(findFieldByName(fields, 'Status')?.id).toBe('f2');
  });

  it('should return null when not found', () => {
    expect(findFieldByName([{ name: 'Title' }], 'Status')).toBeNull();
    expect(findFieldByName(null, 'Status')).toBeNull();
    expect(findFieldByName([], 'Status')).toBeNull();
  });
});

describe('findOptionByName', () => {
  it('should find an option by name within a single-select field', () => {
    const field = {
      name: 'Status',
      options: [
        { id: 'o1', name: 'Backlog' },
        { id: 'o2', name: 'In Progress' },
      ],
    };
    expect(findOptionByName(field, 'In Progress')?.id).toBe('o2');
  });

  it('should return null for missing option or missing field', () => {
    expect(findOptionByName({ name: 'X' }, 'Y')).toBeNull();
    expect(findOptionByName(null, 'Y')).toBeNull();
    expect(findOptionByName({ name: 'X', options: [] }, 'Y')).toBeNull();
  });
});

describe('findItemByIssueNumber', () => {
  it('should find an item by linked issue number', () => {
    const items = [
      { id: 'a', content: { number: 1 } },
      { id: 'b', content: { number: 42 } },
    ];
    expect(findItemByIssueNumber(items, 42)?.id).toBe('b');
  });

  it('should coerce string numbers', () => {
    const items = [{ id: 'a', content: { number: 42 } }];
    expect(findItemByIssueNumber(items, '42')?.id).toBe('a');
  });

  it('should return null when not found or input is not numeric', () => {
    expect(findItemByIssueNumber([], 1)).toBeNull();
    expect(findItemByIssueNumber([{ id: 'a' }], 'not-a-number')).toBeNull();
    expect(findItemByIssueNumber(null, 1)).toBeNull();
  });
});

describe('filterItemsByStatus', () => {
  it('should filter items to those matching a Status value', () => {
    const items = [
      { id: 'a', status: 'Backlog' },
      { id: 'b', status: 'In progress' },
      { id: 'c', status: 'Backlog' },
    ];
    expect(filterItemsByStatus(items, 'Backlog').map((item: { id: string }) => item.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('should return an empty array when nothing matches', () => {
    expect(filterItemsByStatus([{ status: 'X' }], 'Y')).toEqual([]);
    expect(filterItemsByStatus(null, 'Y')).toEqual([]);
  });
});
