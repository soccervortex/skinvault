"use client";

import { useEffect } from 'react';

/**
 * Handles Next.js chunk loading errors by automatically reloading the page.
 * This prevents 404 errors for chunk files that occur during deployments.
 */
export default function ChunkErrorHandler() {
  useEffect(() => {
    // Track if we've already attempted a reload to prevent infinite loops
    const reloadKey = '__chunk_reload_attempted';
    const hasAttemptedReload = sessionStorage.getItem(reloadKey);

    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error || event.message || '';
      const errorString = String(error).toLowerCase();
      
      // Check if this is a chunk loading error (404 on JS chunks)
      const isChunkError = 
        errorString.includes('loading chunk') ||
        errorString.includes('failed to fetch dynamically imported module') ||
        errorString.includes('chunk load failed') ||
        (event.filename && (
          event.filename.includes('/_next/static/chunks/') ||
          event.filename.includes('/_next/static/chunks/')
        )) ||
        (event.message && event.message.includes('net::err_aborted'));

      if (isChunkError && !hasAttemptedReload) {
        // Mark that we've attempted a reload
        sessionStorage.setItem(reloadKey, 'true');
        
        // Clear the flag after 5 seconds to allow future reloads if needed
        setTimeout(() => {
          sessionStorage.removeItem(reloadKey);
        }, 5000);

        // Reload the page after a short delay to get fresh chunks
        console.warn('Chunk loading error detected, reloading page...');
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    };

    // Also listen for unhandled promise rejections (Next.js chunk errors often come as rejected promises)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason || '';
      const reasonString = String(reason).toLowerCase();
      
      const isChunkError = 
        reasonString.includes('loading chunk') ||
        reasonString.includes('failed to fetch dynamically imported module') ||
        reasonString.includes('chunk load failed') ||
        reasonString.includes('net::err_aborted') ||
        (typeof event.reason === 'string' && event.reason.includes('/_next/static/chunks/'));

      if (isChunkError && !hasAttemptedReload) {
        // Mark that we've attempted a reload
        sessionStorage.setItem(reloadKey, 'true');
        
        // Clear the flag after 5 seconds
        setTimeout(() => {
          sessionStorage.removeItem(reloadKey);
        }, 5000);

        // Prevent the default error handling
        event.preventDefault();
        
        // Reload the page
        console.warn('Chunk loading promise rejection detected, reloading page...');
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    };

    // Add event listeners
    window.addEventListener('error', handleChunkError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}

