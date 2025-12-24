/**
 * Centralized Error Handling
 * Integrates with Sentry for error tracking
 */

import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

/**
 * Capture and log an error
 */
export function captureError(
  error: Error | unknown,
  context?: ErrorContext
): void {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error captured:', error);
    if (context) {
      console.error('Error context:', context);
    }
  }

  // Send to Sentry if configured
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        action: context?.action,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.metadata,
    });
  }
}

/**
 * Capture a message (non-error)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${level.toUpperCase()}]`, message);
    if (context) {
      console.log('Context:', context);
    }
  }

  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level: level as Sentry.SeverityLevel,
      tags: {
        action: context?.action,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.metadata,
    });
  }
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Set user context for Sentry
 */
export function setUserContext(userId: string, metadata?: Record<string, any>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser({
      id: userId,
      ...metadata,
    });
  }
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

