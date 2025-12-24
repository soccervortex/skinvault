"use client";

import { useEffect } from 'react';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Analytics wrapper that suppresses expected console warnings and network errors
 * These warnings/errors appear when ad blockers block the analytics scripts (expected behavior)
 */
export default function VercelAnalytics() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Suppress expected Vercel Analytics warnings (they're normal with ad blockers)
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalLog = console.log;
    
    const suppressVercelWarnings = (message: string): boolean => {
      return (
        message.includes('[Vercel Web Analytics]') ||
        message.includes('[Vercel Speed Insights]') ||
        message.includes('Failed to load script from /_vercel/insights') ||
        message.includes('Failed to load script from /_vercel/speed-insights') ||
        message.includes('ERR_BLOCKED_BY_CLIENT') ||
        message.includes('_vercel/insights') ||
        message.includes('_vercel/speed-insights')
      );
    };
    
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      if (suppressVercelWarnings(message)) {
        return; // Suppress these expected warnings
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      if (suppressVercelWarnings(message)) {
        return; // Suppress these expected errors
      }
      originalError.apply(console, args);
    };
    
    console.log = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      if (suppressVercelWarnings(message)) {
        return; // Suppress these expected logs
      }
      originalLog.apply(console, args);
    };
    
    // Suppress network errors for Vercel scripts
    const originalFetch = window.fetch;
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = input?.toString() || '';
      if (url.includes('_vercel/insights') || url.includes('_vercel/speed-insights')) {
        try {
          return await originalFetch(input, init);
        } catch (error: any) {
          // Suppress network errors for Vercel Analytics (expected with ad blockers)
          if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT') || 
              error?.message?.includes('Failed to fetch') ||
              error?.name === 'TypeError') {
            // Return a mock response to prevent errors from propagating
            return new Response(null, { status: 0, statusText: 'Blocked by client' });
          }
          throw error;
        }
      }
      return originalFetch(input, init);
    };
    
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
      console.log = originalLog;
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

