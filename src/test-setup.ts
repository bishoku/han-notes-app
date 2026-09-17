/**
 * Global test setup for Vitest.
 * Provides minimal browser API mocks needed by modules that guard with
 * `typeof localStorage === 'undefined'` or `typeof window === 'undefined'`.
 */

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const _store: Record<string, string> = {};
const mockLocalStorage: Storage = {
  getItem: (key) => _store[key] ?? null,
  setItem: (key, value) => { _store[key] = String(value); },
  removeItem: (key) => { delete _store[key]; },
  clear: () => { Object.keys(_store).forEach((k) => delete _store[k]); },
  get length() { return Object.keys(_store).length; },
  key: (index) => Object.keys(_store)[index] ?? null,
};

try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
  });
} catch {
  // Already defined — ignore
}

// ---------------------------------------------------------------------------
// Minimal window mock (location + event stubs)
// ---------------------------------------------------------------------------
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    location: {
      origin: 'http://localhost:5173',
      pathname: '/',
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    // Forward Web Crypto API so modules using `window.crypto` work in Node
    crypto: (globalThis as any).crypto,
  };
}
