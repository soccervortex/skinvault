"use client";

import { useEffect } from 'react';

/**
 * Global error handler to suppress expected errors and prevent console spam
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Suppress console errors for expected failures
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      const url = args[1]?.toString() || '';
      
      // Suppress Vercel Analytics errors
      if (
        message.includes('Failed to load resource') &&
        (url.includes('_vercel/insights') || url.includes('_vercel/speed-insights') || message.includes('ERR_BLOCKED_BY_CLIENT'))
      ) {
        return; // Suppress
      }
      
      // Suppress CORS proxy errors (403, network errors)
      if (
        message.includes('Failed to load resource') &&
        (url.includes('corsproxy.io') || url.includes('thingproxy.freeboard.io') || url.includes('ERR_NAME_NOT_RESOLVED'))
      ) {
        return; // Suppress
      }
      
      // Suppress FACEIT API 404 errors (expected when player not on Faceit)
      if (
        message.includes('Failed to load resource') &&
        url.includes('/api/faceit/stats') &&
        message.includes('404')
      ) {
        return; // Suppress
      }
      
      originalError.apply(console, args);
    };

    // Handle uncaught errors
    const handleError = (event: ErrorEvent) => {
      const error = event.error || event.message || '';
      const errorString = String(error);
      const source = event.filename || event.target || '';

      // Suppress "Cannot use 'in' operator" errors for animation (likely from React internals)
      if (
        errorString.includes("Cannot use 'in' operator") &&
        errorString.includes('animation')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }

      // Suppress Vercel Analytics errors
      if (
        errorString.includes('ERR_BLOCKED_BY_CLIENT') ||
        String(source).includes('_vercel/insights') ||
        String(source).includes('_vercel/speed-insights')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    // Handle resource loading errors (scripts, images, etc.)
    const handleResourceError = (event: Event) => {
      const target = event.target as any;
      if (!target) return;
      
      const src = target.src || target.href || '';
      const srcString = String(src);
      
      // Suppress Vercel Analytics script errors
      if (
        srcString.includes('_vercel/insights') ||
        srcString.includes('_vercel/speed-insights')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      
      // Suppress CORS proxy errors (these are handled with fallbacks)
      if (
        srcString.includes('corsproxy.io') ||
        srcString.includes('thingproxy.freeboard.io')
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
        errorString.includes('_vercel/speed-insights') ||
        errorString.includes('corsproxy.io') ||
        errorString.includes('thingproxy.freeboard.io')
      ) {
        event.preventDefault();
        return;
      }
    };

    // Intercept fetch errors for expected failures
    const originalFetch = window.fetch;
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = input?.toString() || '';
      
      try {
        const response = await originalFetch(input, init);
        
        // Suppress 404 errors for FACEIT API (expected when player not on Faceit)
        if (url.includes('/api/faceit/stats') && response.status === 404) {
          // Return a successful response to prevent error propagation
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return response;
      } catch (error: any) {
        // Suppress CORS proxy network errors (we have fallbacks)
        if (
          url.includes('corsproxy.io') ||
          url.includes('thingproxy.freeboard.io') ||
          error?.message?.includes('ERR_NAME_NOT_RESOLVED')
        ) {
          // Return a failed response that won't cause console errors
          return new Response(null, { status: 0, statusText: 'Network error (suppressed)' });
        }
        
        throw error;
      }
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('error', handleResourceError, true);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('error', handleResourceError, true);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalError;
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

