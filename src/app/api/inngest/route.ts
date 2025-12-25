/**
 * Inngest API Route
 * Handles webhooks from Inngest
 */

import { serve } from 'inngest/next';
import { inngest } from '@/app/lib/inngest';

// Import your Inngest functions
import { 
  checkPriceAlerts,
  sendWelcomeEmail,
  processFailedPurchases,
  automatedXPosting
} from '@/app/lib/inngest-functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkPriceAlerts,
    sendWelcomeEmail,
    processFailedPurchases,
    automatedXPosting,
    // Add more functions here
  ],
});

