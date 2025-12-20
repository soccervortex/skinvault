/**
 * Safe localStorage access utilities
 * Handles cases where localStorage is blocked by browser privacy settings or in sandboxed contexts
 */

/**
 * Check if localStorage is available and accessible
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely get an item from localStorage
 * Returns null if localStorage is not available or if there's an error
 */
export function safeLocalStorageGetItem(key: string): string | null {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely set an item in localStorage
 * Returns false if localStorage is not available or if there's an error
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 * Returns false if localStorage is not available or if there's an error
 */
export function safeLocalStorageRemoveItem(key: string): boolean {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if sessionStorage is available and accessible
 */
export function isSessionStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const testKey = '__sessionStorage_test__';
    window.sessionStorage.setItem(testKey, 'test');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

