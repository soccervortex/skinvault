/**
 * Inngest Integration
 * Background jobs and scheduled tasks
 */

import { Inngest } from 'inngest';

// Initialize Inngest client
export const inngest = new Inngest({
  id: 'skinvaults',
  name: 'SkinVaults',
});

/**
 * Helper to check if Inngest is configured
 */
export function isInngestConfigured(): boolean {
  return !!process.env.INNGEST_EVENT_KEY;
}

/**
 * Send an event to Inngest
 */
export async function sendInngestEvent(
  name: string,
  data?: Record<string, any>
): Promise<void> {
  if (!isInngestConfigured()) {
    console.warn('Inngest not configured, skipping event:', name);
    return;
  }

  try {
    await inngest.send({
      name,
      data: data || {},
    });
  } catch (error) {
    console.error('Failed to send Inngest event:', error);
  }
}

