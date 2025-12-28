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
          // Return a mock response to prevent errors from propagating
          return new Response(null, { status: 0, statusText: 'Blocked by client' });
        }
      }
      return originalFetch(input, init);
    };
    
    // Also intercept script loading errors
    const originalErrorHandler = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      if (typeof message === 'string' && (
        message.includes('_vercel/insights') ||
        message.includes('_vercel/speed-insights') ||
        message.includes('ERR_BLOCKED_BY_CLIENT') ||
        message.includes('net::ERR_BLOCKED_BY_CLIENT')
      )) {
        return true; // Suppress the error
      }
      if (originalErrorHandler) {
        return originalErrorHandler.call(window, message, source, lineno, colno, error);
      }
      return false;
    };
    
    // Also suppress errors from XMLHttpRequest (used by some libraries)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      const urlStr = url.toString();
      if (urlStr.includes('_vercel/insights') || urlStr.includes('_vercel/speed-insights')) {
        // Store URL for later check
        (this as any)._isVercelRequest = true;
      }
      return originalXHROpen.apply(this, [method, url, ...args] as any);
    };
    
    XMLHttpRequest.prototype.send = function(...args: any[]) {
      if ((this as any)._isVercelRequest) {
        this.addEventListener('error', (e) => {
          // Suppress Vercel Analytics errors
          e.stopPropagation();
        }, { once: true });
      }
      return originalXHRSend.apply(this, args as any);
    };
    
    // Suppress resource loading errors (for Network tab errors)
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
      if (type === 'error' && listener) {
        const wrappedListener = function(e: Event) {
          const target = e.target as any;
          if (target && (target.src || target.href)) {
            const url = target.src || target.href || '';
            if (url.includes('_vercel/insights') || url.includes('_vercel/speed-insights')) {
              e.stopPropagation();
              e.preventDefault();
              return;
            }
          }
          if (typeof listener === 'function') {
            listener.call(this, e);
          }
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Suppress unhandled promise rejections for Vercel scripts
    const originalUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = function(event: PromiseRejectionEvent) {
      const reason = event.reason?.toString() || '';
      if (reason.includes('_vercel/insights') || reason.includes('_vercel/speed-insights') || 
          reason.includes('ERR_BLOCKED_BY_CLIENT') || reason.includes('net::ERR_BLOCKED_BY_CLIENT')) {
        event.preventDefault();
        return;
      }
      if (originalUnhandledRejection) {
        return originalUnhandledRejection.call(window, event);
      }
    };
    
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
      console.log = originalLog;
      window.fetch = originalFetch;
      window.onerror = originalErrorHandler;
      window.onunhandledrejection = originalUnhandledRejection;
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
      EventTarget.prototype.addEventListener = originalAddEventListener;
    };
  }, []);

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

