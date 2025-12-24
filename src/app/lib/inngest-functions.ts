/**
 * Inngest Functions
 * Background jobs and scheduled tasks
 */

import { inngest } from './inngest';
import { dbGet } from '@/app/utils/database';
// import { sendDiscordDM } from '@/app/utils/discord-utils'; // Uncomment when needed

/**
 * Check price alerts and send notifications
 * Runs every 5 minutes
 */
export const checkPriceAlerts = inngest.createFunction(
  { id: 'check-price-alerts' },
  { cron: '*/5 * * * *' }, // Every 5 minutes
  async ({ event, step }) => {
    return await step.run('check-alerts', async () => {
      try {
        // Get all active price alerts
        const alerts = await dbGet<any[]>('price_alerts');
        if (!alerts || alerts.length === 0) {
          return { checked: 0, triggered: 0 };
        }

        let triggered = 0;

        for (const alert of alerts) {
          // Skip if already triggered
          if (alert.triggered) continue;

          // Get current price (you'll need to implement this)
          // const currentPrice = await getCurrentPrice(alert.market_hash_name);
          
          // Check if price condition is met
          // if (checkPriceCondition(currentPrice, alert.targetPrice, alert.condition)) {
          //   // Send Discord notification
          //   await sendDiscordDM(alert.discordId, {
          //     content: `Price alert triggered! ${alert.market_hash_name} is now ${alert.condition} ${alert.targetPrice}`,
          //   });
          //   
          //   // Mark as triggered
          //   alert.triggered = true;
          //   triggered++;
          // }
        }

        return { checked: alerts.length, triggered };
      } catch (error) {
        console.error('Price alert check failed:', error);
        throw error;
      }
    });
  }
);

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/registered' },
  async ({ event, step }) => {
    return await step.run('send-email', async () => {
      const { userId, email } = event.data;
      
      // Send welcome email logic here
      // await sendEmail(email, 'Welcome to SkinVaults!', ...);
      
      return { sent: true, userId };
    });
  }
);

/**
 * Process failed purchases
 */
export const processFailedPurchases = inngest.createFunction(
  { id: 'process-failed-purchases' },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ event, step }) => {
    return await step.run('process-failures', async () => {
      try {
        const failedPurchases = await dbGet<any[]>('failed_purchases');
        if (!failedPurchases || failedPurchases.length === 0) {
          return { processed: 0 };
        }

        // Process failed purchases logic here
        // This would check Stripe, retry fulfillment, etc.

        return { processed: failedPurchases.length };
      } catch (error) {
        console.error('Failed purchase processing error:', error);
        throw error;
      }
    });
  }
);

