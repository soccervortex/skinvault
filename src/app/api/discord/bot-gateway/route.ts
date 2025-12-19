import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Gateway API for local Discord bot to send interactions to the website
// This allows the bot to be run locally while still interacting with the website's database

interface BotGatewayRequest {
  action: 'send_dm' | 'send_welcome' | 'check_alerts' | 'trigger_alert';
  discordId?: string;
  steamId?: string;
  message?: string;
  alertId?: string;
  priceData?: any;
}

export async function POST(request: Request) {
  try {
    // Verify request is from authorized bot (you can add API key auth here)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.DISCORD_BOT_API_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: BotGatewayRequest = await request.json();
    const { action, discordId, steamId, message, alertId, priceData } = body;

    switch (action) {
      case 'send_dm':
        if (!discordId || !message) {
          return NextResponse.json({ error: 'Missing discordId or message' }, { status: 400 });
        }
        // Store message to be sent by bot
        // The bot will poll this endpoint or use webhooks
        const dmQueueKey = 'discord_dm_queue';
        const dmQueue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(dmQueueKey) || [];
        dmQueue.push({
          discordId,
          message,
          timestamp: Date.now(),
        });
        await kv.set(dmQueueKey, dmQueue);
        return NextResponse.json({ success: true, queued: true });

      case 'send_welcome':
        if (!discordId) {
          return NextResponse.json({ error: 'Missing discordId' }, { status: 400 });
        }
        const welcomeMessage = `🎉 **Thanks for connecting with SkinVault Bot!**

You can now:
• Set up **price alerts** for CS2 skins
• Get notified when prices hit your target
• Use **/wishlist** to view your tracked items
• Manage alerts from your profile at skinvaults.vercel.app

**Commands:**
\`/wishlist\` - View your wishlist with prices
\`/help\` - Get help with commands

Happy trading! 🚀`;
        
        const welcomeQueueKey = 'discord_dm_queue';
        const welcomeQueue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(welcomeQueueKey) || [];
        welcomeQueue.push({
          discordId,
          message: welcomeMessage,
          timestamp: Date.now(),
        });
        await kv.set(welcomeQueueKey, welcomeQueue);
        return NextResponse.json({ success: true, queued: true });

      case 'trigger_alert':
        if (!alertId || !priceData) {
          return NextResponse.json({ error: 'Missing alertId or priceData' }, { status: 400 });
        }
        // Get alert details
        const alertsKey = 'price_alerts';
        const alerts = await kv.get<Record<string, any>>(alertsKey) || {};
        const alert = alerts[alertId];
        
        if (!alert) {
          return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
        }

        // Mark as triggered and queue notification
        alert.triggered = true;
        alerts[alertId] = alert;
        await kv.set(alertsKey, alerts);

        const notificationMessage = `🔔 **Price Alert Triggered!**

**Item:** ${alert.marketHashName}
**Target:** ${alert.condition === 'below' ? '≤' : '≥'} ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: alert.currency === '1' ? 'USD' : 'EUR',
        }).format(alert.targetPrice)}
**Current Price:** ${priceData.lowest || 'N/A'}

View on SkinVault: https://skinvaults.vercel.app/item/${encodeURIComponent(alert.marketHashName)}`;

        const notificationQueueKey = 'discord_dm_queue';
        const notificationQueue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(notificationQueueKey) || [];
        notificationQueue.push({
          discordId: alert.discordId,
          message: notificationMessage,
          timestamp: Date.now(),
        });
        await kv.set(notificationQueueKey, notificationQueue);
        return NextResponse.json({ success: true, triggered: true });

      case 'check_alerts':
        // Return pending DM queue for bot to process
        const queueKey = 'discord_dm_queue';
        const queue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(queueKey) || [];
        
        // Clear queue after reading (bot will process these)
        await kv.set(queueKey, []);
        
        return NextResponse.json({ success: true, queue });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bot gateway error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for bot to poll for messages
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.DISCORD_BOT_API_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const queueKey = 'discord_dm_queue';
    const queue = await kv.get<Array<{ discordId: string; message: string; timestamp: number }>>(queueKey) || [];
    
    // Don't clear queue on GET - bot should POST to check_alerts to clear
    return NextResponse.json({ success: true, queue, count: queue.length });
  } catch (error) {
    console.error('Bot gateway GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

