"use client";

import { useEffect } from 'react';

/**
 * Global error handler to suppress expected errors and prevent console spam
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Handle uncaught errors
    const handleError = (event: ErrorEvent) => {
      const error = event.error || event.message || '';
      const errorString = String(error);

      // Suppress "Cannot use 'in' operator" errors for animation (likely from React internals)
      if (
        errorString.includes("Cannot use 'in' operator") &&
        errorString.includes('animation')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }

      // Suppress other expected errors
      if (
        errorString.includes('ERR_BLOCKED_BY_CLIENT') ||
        errorString.includes('_vercel/insights') ||
        errorString.includes('_vercel/speed-insights')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason || '';
      const errorString = String(error);

      // Suppress expected promise rejections
      if (
        errorString.includes("Cannot use 'in' operator") &&
        errorString.includes('animation')
      ) {
        event.preventDefault();
        return;
      }

      if (
        errorString.includes('ERR_BLOCKED_BY_CLIENT') ||
        errorString.includes('_vercel/insights') ||
        errorString.includes('_vercel/speed-insights')
      ) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}

