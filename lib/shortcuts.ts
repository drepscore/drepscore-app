export interface Shortcut {
  key: string;
  label: string;
  description: string;
  category: 'navigation' | 'actions';
}

export const SHORTCUTS: Shortcut[] = [
  { key: '⌘K', label: 'Cmd+K', description: 'Open command palette', category: 'actions' },
  { key: '?', label: '?', description: 'Show keyboard shortcuts', category: 'actions' },
  { key: '/', label: '/', description: 'Open search', category: 'actions' },
  { key: 'Esc', label: 'Escape', description: 'Close dialog / palette', category: 'actions' },
  { key: 'H', label: 'H', description: 'Go to Home', category: 'navigation' },
  { key: 'D', label: 'D', description: 'Go to Discover', category: 'navigation' },
  { key: 'P', label: 'P', description: 'Go to Proposals', category: 'navigation' },
  { key: 'G', label: 'G', description: 'Go to My Delegation', category: 'navigation' },
];

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}
