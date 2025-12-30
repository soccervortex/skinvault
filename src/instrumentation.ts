/**
 * Next.js Instrumentation Hook
 * Required for Sentry and other monitoring tools
 */

export async function register() {
  // 1. Initialize Server-side Monitoring (Sentry)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./app/lib/sentry-server');
  }

  // 2. Initialize BotId Protection
  // We import this dynamically within register to ensure it runs 
  // on the server/edge during initialization.
  const { initBotId } = await import('botid/client/core');

  initBotId({
    protect: [
      {
        path: '/api/checkout',
        method: 'POST',
      },
      {
        // Wildcards can be used to expand multiple segments
        // /team/*/activate will match /team/a/activate, etc.
        path: '/team/*/activate',
        method: 'POST',
      },
      {
        // Wildcards can also be used at the end for dynamic routes
        path: '/api/user/*',
        method: 'POST',
      },
    ],
  });

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime initialization (if needed)
  }
}