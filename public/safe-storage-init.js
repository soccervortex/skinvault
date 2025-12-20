/**
 * Safe Storage Polyfill
 * Must load BEFORE React to prevent SecurityErrors during hydration
 * This script creates safe polyfills for localStorage and sessionStorage
 * when they are blocked by browser privacy settings
 */

(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;

  // Polyfill for localStorage
  try {
    var testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
  } catch (e) {
    // localStorage is blocked, create in-memory polyfill
    var localStorageData = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: function(key) {
          return localStorageData[key] || null;
        },
        setItem: function(key, value) {
          try {
            localStorageData[key] = String(value);
          } catch (err) {
            // Ignore errors
          }
        },
        removeItem: function(key) {
          try {
            delete localStorageData[key];
          } catch (err) {
            // Ignore errors
          }
        },
        clear: function() {
          try {
            localStorageData = {};
          } catch (err) {
            // Ignore errors
          }
        },
        get length() {
          return Object.keys(localStorageData).length;
        },
        key: function(index) {
          var keys = Object.keys(localStorageData);
          return keys[index] || null;
        }
      },
      writable: false,
      configurable: false
    });
  }

  // Polyfill for sessionStorage
  try {
    var testKey2 = '__sessionStorage_test__';
    window.sessionStorage.setItem(testKey2, 'test');
    window.sessionStorage.removeItem(testKey2);
  } catch (e) {
    // sessionStorage is blocked, create in-memory polyfill
    var sessionStorageData = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: function(key) {
          return sessionStorageData[key] || null;
        },
        setItem: function(key, value) {
          try {
            sessionStorageData[key] = String(value);
          } catch (err) {
            // Ignore errors
          }
        },
        removeItem: function(key) {
          try {
            delete sessionStorageData[key];
          } catch (err) {
            // Ignore errors
          }
        },
        clear: function() {
          try {
            sessionStorageData = {};
          } catch (err) {
            // Ignore errors
          }
        },
        get length() {
          return Object.keys(sessionStorageData).length;
        },
        key: function(index) {
          var keys = Object.keys(sessionStorageData);
          return keys[index] || null;
        }
      },
      writable: false,
      configurable: false
    });
  }

  // Global error handler for storage errors
  window.addEventListener('error', function(event) {
    if (
      event.error && 
      event.error.name === 'SecurityError' &&
      (event.message && (
        event.message.indexOf('localStorage') !== -1 ||
        event.message.indexOf('sessionStorage') !== -1 ||
        event.message.indexOf('Failed to read') !== -1 ||
        event.message.indexOf('Access is denied') !== -1
      ))
    ) {
      event.preventDefault();
      event.stopPropagation();
      console.warn('Storage access blocked by browser. Using in-memory fallback.');
      return false;
    }
  }, true); // Use capture phase to catch early

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    if (
      event.reason && 
      event.reason.name === 'SecurityError' &&
      (event.reason.message && (
        event.reason.message.indexOf('localStorage') !== -1 ||
        event.reason.message.indexOf('sessionStorage') !== -1 ||
        event.reason.message.indexOf('Failed to read') !== -1 ||
        event.reason.message.indexOf('Access is denied') !== -1
      ))
    ) {
      event.preventDefault();
      console.warn('Storage access blocked by browser. Using in-memory fallback.');
    }
  });
})();

