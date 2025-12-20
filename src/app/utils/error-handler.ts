/**
 * Global error handler for storage-related errors
 * Prevents SecurityErrors from breaking the application
 */

if (typeof window !== 'undefined') {
  // Handle uncaught errors related to storage
  window.addEventListener('error', (event) => {
    if (
      event.error?.name === 'SecurityError' &&
      (event.message?.includes('localStorage') ||
        event.message?.includes('sessionStorage') ||
        event.message?.includes('Failed to read') ||
        event.message?.includes('Access is denied'))
    ) {
      // Prevent the error from breaking the app
      event.preventDefault();
      console.warn('Storage access blocked by browser privacy settings. Some features may not work.');
      return false;
    }
  });

  // Handle unhandled promise rejections related to storage
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason?.name === 'SecurityError' &&
      (event.reason?.message?.includes('localStorage') ||
        event.reason?.message?.includes('sessionStorage') ||
        event.reason?.message?.includes('Failed to read') ||
        event.reason?.message?.includes('Access is denied'))
    ) {
      event.preventDefault();
      console.warn('Storage access blocked by browser privacy settings. Some features may not work.');
    }
  });
}

