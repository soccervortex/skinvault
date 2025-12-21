// Discord Bot Service - Runs with Next.js app
// Handles price alerts and sends Discord DMs

import { kv } from '@vercel/kv';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

interface PriceAlert {
  id: string;
  steamId: string;
  discordId: string;
  marketHashName: string;
  targetPrice: number;
  currency: string;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

// Send Discord DM to user
export async function sendDiscordDM(discordId: string, message: string): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN) {
    console.warn('Discord bot token not configured');
    return false;
  }

  try {
    // Create DM channel
    const channelResponse = await fetch('https://discord.com/api/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: discordId,
      }),
    });

    if (!channelResponse.ok) {
      console.error('Failed to create DM channel:', await channelResponse.text());
      return false;
    }

    const channel = await channelResponse.json();

    // Send message
    const messageResponse = await fetch(`https://discord.com/api/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
      }),
    });

    return messageResponse.ok;
  } catch (error) {
    console.error('Failed to send Discord DM:', error);
    return false;
  }
}

// Send Discord DM with embed
export async function sendDiscordDMEmbed(discordId: string, embed: any): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN) {
    console.warn('Discord bot token not configured');
    return false;
  }

  try {
    // Create DM channel
    const channelResponse = await fetch('https://discord.com/api/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: discordId,
      }),
    });

    if (!channelResponse.ok) {
      console.error('Failed to create DM channel:', await channelResponse.text());
      return false;
    }

    const channel = await channelResponse.json();

    // Send message with embed
    const messageResponse = await fetch(`https://discord.com/api/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    return messageResponse.ok;
  } catch (error) {
    console.error('Failed to send Discord DM embed:', error);
    return false;
  }
}

// Get all active price alerts
export async function getAllPriceAlerts(): Promise<PriceAlert[]> {
  try {
    const alertsKey = 'price_alerts';
    const alerts = await kv.get<Record<string, PriceAlert>>(alertsKey) || {};
    return Object.values(alerts).filter(alert => !alert.triggered);
  } catch (error) {
    console.error('Failed to get price alerts:', error);
    return [];
  }
}

// Parse Steam price string to number (handles formats like "$1,234.56" or "€1.234,56")
function parseSteamPrice(priceStr: string): number {
  // Remove currency symbols and spaces
  let cleaned = priceStr.replace(/[$€£¥\s]/g, '');
  // Handle European format (1.234,56) vs US format (1,234.56)
  if (cleaned.includes(',') && cleaned.split(',')[1]?.length === 2) {
    // European format: replace . with nothing, , with .
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: remove commas
    cleaned = cleaned.replace(/,/g, '');
  }
  return parseFloat(cleaned) || 0;
}

// Check price alerts and send notifications (exported for API route)
export async function checkPriceAlerts(currentPrice: number | string, marketHashName: string, currency: string): Promise<void> {
  try {
    // Parse price if it's a string
    const price = typeof currentPrice === 'string' ? parseSteamPrice(currentPrice) : currentPrice;
    
    const alerts = await getAllPriceAlerts();
    const relevantAlerts = alerts.filter(
      alert => 
        alert.marketHashName === marketHashName &&
        alert.currency === currency &&
        !alert.triggered
    );

    for (const alert of relevantAlerts) {
      const shouldTrigger = 
        (alert.condition === 'below' && price <= alert.targetPrice) ||
        (alert.condition === 'above' && price >= alert.targetPrice);

      if (shouldTrigger) {
        // Format price
        const priceStr = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency === '1' ? 'USD' : 'EUR',
        }).format(price);

        const message = `🔔 **Price Alert Triggered!**\n\n` +
          `**Item:** ${marketHashName}\n` +
          `**Current Price:** ${priceStr}\n` +
          `**Target Price:** ${alert.condition === 'below' ? '≤' : '≥'} ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency === '1' ? 'USD' : 'EUR',
          }).format(alert.targetPrice)}\n\n` +
          `View on SkinVault: ${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/item/${encodeURIComponent(marketHashName)}`;

        // Queue message via bot gateway (preferred method - uses Discord bot)
        try {
          const botGatewayUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online'}/api/discord/bot-gateway`;
          const apiToken = process.env.DISCORD_BOT_API_TOKEN;
          
          const response = await fetch(botGatewayUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {}),
            },
            body: JSON.stringify({
              action: 'send_dm',
              discordId: alert.discordId,
              message: message,
            }),
          });

          if (response.ok) {
          // Mark alert as triggered
          await markAlertTriggered(alert.id);
            console.log(`✅ Queued price alert for ${marketHashName} to Discord user ${alert.discordId}`);
          } else {
            console.error(`❌ Failed to queue price alert: ${response.statusText}`);
            // Fallback: Try direct Discord API (only if bot token is configured)
            if (DISCORD_BOT_TOKEN) {
              const sent = await sendDiscordDM(alert.discordId, message);
              if (sent) {
                await markAlertTriggered(alert.id);
              }
            }
          }
        } catch (queueError) {
          console.error('Failed to queue price alert via bot gateway:', queueError);
          // Fallback: Try direct Discord API (only if bot token is configured)
          if (DISCORD_BOT_TOKEN) {
            const sent = await sendDiscordDM(alert.discordId, message);
            if (sent) {
              await markAlertTriggered(alert.id);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to check price alerts:', error);
  }
}

// Mark alert as triggered
async function markAlertTriggered(alertId: string): Promise<void> {
  try {
    const alertsKey = 'price_alerts';
    const alerts = await kv.get<Record<string, PriceAlert>>(alertsKey) || {};
    
    if (alerts[alertId]) {
      alerts[alertId].triggered = true;
      await kv.set(alertsKey, alerts);
    }
  } catch (error) {
    console.error('Failed to mark alert as triggered:', error);
  }
}

// Initialize Discord bot (called on app startup)
export async function initializeDiscordBot(): Promise<void> {
  if (!DISCORD_BOT_TOKEN) {
    console.warn('Discord bot token not configured. Price alerts will not work.');
    return;
  }

  try {
    // Verify bot token by fetching bot info
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (response.ok) {
      const botInfo = await response.json();
      console.log(`✅ Discord bot initialized: ${botInfo.username}#${botInfo.discriminator}`);
    } else {
      console.error('❌ Failed to initialize Discord bot: Invalid token');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Discord bot:', error);
  }
}

