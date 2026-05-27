/**
 * Provide a real `localStorage` / `sessionStorage` for jsdom-backed Vitest
 * tests.
 *
 * Node 22+ ships `--webstorage` (default on) but the runtime `localStorage` it
 * exposes when `--localstorage-file` is unset is a broken null-prototype
 * object — `clear()` / `setItem()` etc. are undefined. Because jsdom in
 * Vitest uses `globalThis` as the window, Node's broken global shadows
 * jsdom's own Storage and tests that do `localStorage.clear()` throw
 * `TypeError: localStorage.clear is not a function`. CI runs Node 24 with
 * the same default behavior, so this is a real green-test issue, not a
 * local-only DX paper cut.
 *
 * This setup file installs a Map-backed `Storage` shim and re-assigns it to
 * both `globalThis` and `window`, defeating Node's broken global. Cleanup
 * (`localStorage.clear()` in `afterEach`) works against the shim.
 *
 * Wired into the `component` Vitest project's `setupFiles`. No-op for the
 * `unit` (node env) project.
 */

class TestStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function installStorageShim(): void {
  const local = new TestStorage();
  const session = new TestStorage();

  for (const target of [globalThis, typeof window !== 'undefined' ? window : globalThis]) {
    Object.defineProperty(target, 'localStorage', {
      value: local,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(target, 'sessionStorage', {
      value: session,
      configurable: true,
      writable: true,
    });
  }
}

installStorageShim();
