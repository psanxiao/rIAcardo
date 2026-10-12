import '@testing-library/jest-dom';

// jsdom used by Vitest 4 does not expose localStorage on the global scope,
// but the app (auth token, etc.) relies on it. Provide a tiny in-memory
// implementation so tests can run without a real browser storage backend.
if (typeof window.localStorage === 'undefined') {
  const createStorage = () => {
    let store = {};
    return {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
  };

  const storage = createStorage();
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}