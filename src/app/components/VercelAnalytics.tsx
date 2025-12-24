"use client";

import { useEffect } from 'react';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Analytics wrapper that suppresses expected console warnings
 * These warnings appear when ad blockers block the analytics scripts (expected behavior)
 */
export default function VercelAnalytics() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Suppress expected Vercel Analytics warnings (they're normal with ad blockers)
    const originalWarn = console.warn;
    const originalError = console.error;
    
    const suppressVercelWarnings = (message: string): boolean => {
      return (
        message.includes('[Vercel Web Analytics]') ||
        message.includes('[Vercel Speed Insights]') ||
        message.includes('Failed to load script from /_vercel/insights') ||
        message.includes('Failed to load script from /_vercel/speed-insights') ||
        (message.includes('ERR_BLOCKED_BY_CLIENT') && message.includes('_vercel'))
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
    
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

