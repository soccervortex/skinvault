/**
 * Next.js Instrumentation Hook
 * Required for Sentry and other monitoring tools
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side initialization
    await import('./app/lib/sentry-server');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime initialization (if needed)
  }
}

