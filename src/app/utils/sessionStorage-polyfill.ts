/**
 * Safe sessionStorage polyfill
 * Prevents SecurityError when sessionStorage is blocked by browser privacy settings
 */

if (typeof window !== 'undefined') {
  try {
    // Test if sessionStorage is accessible
    const testKey = '__sessionStorage_test__';
    window.sessionStorage.setItem(testKey, 'test');
    window.sessionStorage.removeItem(testKey);
  } catch {
    // sessionStorage is blocked, create a safe in-memory polyfill
    const storage: Record<string, string> = {};
    
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => storage[key] || null,
        setItem: (key: string, value: string) => {
          try {
            storage[key] = String(value);
          } catch {
            // Ignore errors
          }
        },
        removeItem: (key: string) => {
          try {
            delete storage[key];
          } catch {
            // Ignore errors
          }
        },
        clear: () => {
          try {
            Object.keys(storage).forEach(key => delete storage[key]);
          } catch {
            // Ignore errors
          }
        },
        get length() {
          return Object.keys(storage).length;
        },
        key: (index: number) => {
          const keys = Object.keys(storage);
          return keys[index] || null;
        },
      },
      writable: false,
      configurable: false,
    });
  }
}

