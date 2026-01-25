/**
 * Discord Webhook Utility
 * Centralized service for sending notifications to Discord with category-specific channels
 */

// Webhook categories - each can have its own Discord channel
export type WebhookCategory = 
  | 'users'           // New user registrations
  | 'events'          // User logins and other events
  | 'pro'             // Pro grants (admin) and purchases
  | 'purchases'       // All purchases (Pro and consumables)
  | 'payment_success' // Successful payments (including carts)
  | 'payment_failed'  // Failed payments / fulfillment errors
  | 'moderation'      // User bans/unbans
  | 'reports';        // Chat and item reports

// Default webhook URLs (can be overridden by environment variables)
const DEFAULT_WEBHOOKS: Record<WebhookCategory, string> = {
  users: '',
  events: '',
  pro: '',
  purchases: '',
  payment_success: '',
  payment_failed: '',
  moderation: '',
  reports: '',
};

// Get webhook URL for a specific category
function getWebhookUrl(category: WebhookCategory): string | null {
  // Check for category-specific webhook URLs in environment variables first
  const envVar = `DISCORD_WEBHOOK_${category.toUpperCase()}`;
  const categoryUrl = process.env[envVar];
  
  if (categoryUrl) {
    return categoryUrl;
  }
  
  // Use default webhook for this category (left blank by default)
  if (DEFAULT_WEBHOOKS[category]) return DEFAULT_WEBHOOKS[category];

  // Final fallback to general webhook
  return process.env.DISCORD_WEBHOOK_URL || null;
}

async function postDiscordWebhook(webhookUrl: string, embeds: DiscordEmbed[], strict: boolean): Promise<void> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 10_000) : null;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds }),
      signal: controller?.signal,
    });

    if (!res.ok) {
      let text = '';
      try {
        text = await res.text();
      } catch {
      }
      const msg = `Discord webhook failed (${res.status} ${res.statusText})${text ? `: ${text.slice(0, 500)}` : ''}`;
      if (strict) throw new Error(msg);
      console.error(msg);
    }
  } catch (error) {
    if (strict) throw error;
    console.error(`Failed to send Discord webhook:`, error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  thumbnail?: {
    url: string;
  };
  footer?: {
    text: string;
  };
  timestamp?: string;
}

/**
 * Send a Discord webhook notification to a specific category channel
 */
export async function sendDiscordWebhook(
  embeds: DiscordEmbed[], 
  category: WebhookCategory
): Promise<void> {
  try {
    const webhookUrl = getWebhookUrl(category);
    
    if (!webhookUrl) {
      console.warn(`No webhook URL configured for category: ${category}`);
      return;
    }

    await postDiscordWebhook(webhookUrl, embeds, false);
  } catch (error) {
    console.error(`Failed to send Discord webhook for ${category}:`, error);
    // Don't throw - webhook failures shouldn't break the main flow
  }
}

export async function sendDiscordWebhookStrict(embeds: DiscordEmbed[], category: WebhookCategory): Promise<void> {
  const webhookUrl = getWebhookUrl(category);
  if (!webhookUrl) {
    throw new Error(`No webhook URL configured for category: ${category}`);
  }
  await postDiscordWebhook(webhookUrl, embeds, true);
}

export async function notifyCartPurchaseStrict(
  steamId: string,
  cartId: string,
  summary: { grantedCredits: number; grantedSpins: number; grantedProMonths: number; itemCount: number },
  amount: number,
  currency: string,
  sessionId: string
): Promise<void> {
  const embed: DiscordEmbed = {
    title: '🛒 Cart Purchase',
    description: 'A user has completed a cart checkout.',
    color: 0x00ff00,
    fields: [
      { name: 'Steam ID', value: `\`${steamId}\``, inline: true },
      { name: 'Cart ID', value: `\`${cartId}\``, inline: true },
      { name: 'Items', value: `${Math.max(0, Math.floor(Number(summary?.itemCount || 0)))}`, inline: true },
      { name: 'Granted Credits', value: `${Math.max(0, Math.floor(Number(summary?.grantedCredits || 0))).toLocaleString('en-US')}`, inline: true },
      { name: 'Granted Spins', value: `${Math.max(0, Math.floor(Number(summary?.grantedSpins || 0))).toLocaleString('en-US')}`, inline: true },
      { name: 'Pro Months', value: `${Math.max(0, Math.floor(Number(summary?.grantedProMonths || 0)))}`, inline: true },
      { name: 'Amount', value: `${Number(amount || 0).toFixed(2)} ${String(currency || 'eur').toUpperCase()}`, inline: true },
      { name: 'Session ID', value: `\`${sessionId}\``, inline: false },
      { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
    ],
    footer: { text: 'SkinVaults Notification System' },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhookStrict([embed], 'payment_success');
}

export async function notifyPaymentFailureStrict(payload: {
  title?: string;
  type?: string;
  steamId?: string;
  sessionId?: string;
  cartId?: string;
  stage?: string;
  error?: string;
  amount?: number;
  currency?: string;
}): Promise<void> {
  const embed: DiscordEmbed = {
    title: payload.title || '❌ Payment Failure',
    description: 'A payment or fulfillment step failed.',
    color: 0xff0000,
    fields: [
      ...(payload.type ? [{ name: 'Type', value: String(payload.type), inline: true }] : []),
      ...(payload.steamId ? [{ name: 'Steam ID', value: `\`${payload.steamId}\``, inline: true }] : []),
      ...(payload.cartId ? [{ name: 'Cart ID', value: `\`${payload.cartId}\``, inline: true }] : []),
      ...(payload.amount != null ? [{ name: 'Amount', value: `${Number(payload.amount || 0).toFixed(2)} ${String(payload.currency || 'eur').toUpperCase()}`, inline: true }] : []),
      ...(payload.sessionId ? [{ name: 'Session ID', value: `\`${payload.sessionId}\``, inline: false }] : []),
      ...(payload.stage ? [{ name: 'Stage', value: String(payload.stage), inline: false }] : []),
      ...(payload.error ? [{ name: 'Error', value: String(payload.error).slice(0, 900), inline: false }] : []),
      { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
    ],
    footer: { text: 'SkinVaults Notification System' },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhookStrict([embed], 'payment_failed');
}

/**
 * Send notification for new user registration
 */
export async function notifyNewUser(steamId: string, steamName?: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: '👤 New User Registered',
    description: 'A new user has joined SkinVaults!',
    color: 0x00ff00, // Green
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Steam Name',
        value: steamName || 'Unknown',
        inline: true,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'users');
}

/**
 * Send notification for user login (existing users)
 */
export async function notifyUserLogin(steamId: string, steamName?: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: '🔐 User Login',
    description: 'A user has logged in to SkinVaults',
    color: 0x5865f2, // Discord blue
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Steam Name',
        value: steamName || 'Unknown',
        inline: true,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'events');
}

/**
 * Send notification for new Pro user (granted via admin)
 */
export async function notifyNewProUser(steamId: string, months: number, proUntil: string, grantedBy?: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: '⭐ New Pro User',
    description: 'Pro status has been granted to a user!',
    color: 0xffd700, // Gold
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Months Added',
        value: `${months} month${months !== 1 ? 's' : ''}`,
        inline: true,
      },
      {
        name: 'Expires',
        value: `<t:${Math.floor(new Date(proUntil).getTime() / 1000)}:F>`,
        inline: true,
      },
      ...(grantedBy ? [{
        name: 'Granted By',
        value: `\`${grantedBy}\``,
        inline: false,
      }] : []),
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'pro');
}

/**
 * Send notification for Pro purchase
 */
export async function notifyProPurchase(steamId: string, months: number, amount: number, currency: string, proUntil: string, sessionId: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: '💰 Pro Purchase',
    description: 'A user has purchased Pro subscription!',
    color: 0x00ff00, // Green
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Months',
        value: `${months} month${months !== 1 ? 's' : ''}`,
        inline: true,
      },
      {
        name: 'Amount',
        value: `${amount.toFixed(2)} ${currency.toUpperCase()}`,
        inline: true,
      },
      {
        name: 'Expires',
        value: `<t:${Math.floor(new Date(proUntil).getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: 'Session ID',
        value: `\`${sessionId}\``,
        inline: false,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  // Send to both 'pro' and 'purchases' channels
  await sendDiscordWebhook([embed], 'pro');
  await sendDiscordWebhook([embed], 'purchases');
}

export async function notifyConsumablePurchaseStrict(steamId: string, consumableType: string, quantity: number, amount: number, currency: string, sessionId: string): Promise<void> {
  const typeEmoji: Record<string, string> = {
    discord_access: '🎁',
    wishlist_slot: '📝',
    price_tracker: '📊',
  };

  const emoji = typeEmoji[consumableType] || '🎁';
  const typeName = consumableType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const embed: DiscordEmbed = {
    title: `${emoji} Consumable Purchase`,
    description: 'A user has purchased a consumable item!',
    color: 0x0099ff,
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Type',
        value: typeName,
        inline: true,
      },
      {
        name: 'Quantity',
        value: `${quantity}`,
        inline: true,
      },
      {
        name: 'Amount',
        value: `${amount.toFixed(2)} ${currency.toUpperCase()}`,
        inline: true,
      },
      {
        name: 'Session ID',
        value: `\`${sessionId}\``,
        inline: false,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhookStrict([embed], 'purchases');
}

export async function notifyCreditsPurchaseStrict(steamId: string, credits: number, pack: string, amount: number, currency: string, sessionId: string): Promise<void> {
  const packLabel = String(pack || '').trim();
  const details = packLabel ? `${credits.toLocaleString('en-US')} credits (${packLabel})` : `${credits.toLocaleString('en-US')} credits`;

  const embed: DiscordEmbed = {
    title: '💳 Credits Purchase',
    description: 'A user has purchased credits!',
    color: 0x00ff00,
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Credits',
        value: details,
        inline: true,
      },
      {
        name: 'Amount',
        value: `${amount.toFixed(2)} ${currency.toUpperCase()}`,
        inline: true,
      },
      {
        name: 'Session ID',
        value: `\`${sessionId}\``,
        inline: false,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhookStrict([embed], 'purchases');
}

export async function notifySpinsPurchaseStrict(steamId: string, spins: number, pack: string, amount: number, currency: string, sessionId: string): Promise<void> {
  const packLabel = String(pack || '').trim();
  const details = packLabel ? `${spins.toLocaleString('en-US')} spins (${packLabel})` : `${spins.toLocaleString('en-US')} spins`;

  const embed: DiscordEmbed = {
    title: '🎡 Spins Purchase',
    description: 'A user has purchased spins!',
    color: 0x00ff00,
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Spins',
        value: details,
        inline: true,
      },
      {
        name: 'Amount',
        value: `${amount.toFixed(2)} ${currency.toUpperCase()}`,
        inline: true,
      },
      {
        name: 'Session ID',
        value: `\`${sessionId}\``,
        inline: false,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhookStrict([embed], 'purchases');
}

export async function notifyProPurchaseStrict(steamId: string, months: number, amount: number, currency: string, proUntil: string, sessionId: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: '💰 Pro Purchase',
    description: 'A user has purchased Pro subscription!',
    color: 0x00ff00,
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Months',
        value: `${months} month${months !== 1 ? 's' : ''}`,
        inline: true,
      },
      {
        name: 'Amount',
        value: `${amount.toFixed(2)} ${currency.toUpperCase()}`,
        inline: true,
      },
      {
        name: 'Expires',
        value: `<t:${Math.floor(new Date(proUntil).getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: 'Session ID',
        value: `\`${sessionId}\``,
        inline: false,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhookStrict([embed], 'pro');
  await sendDiscordWebhookStrict([embed], 'purchases');
}

/**
 * Send notification for consumable purchase
 */
export async function notifyConsumablePurchase(steamId: string, consumableType: string, quantity: number, amount: number, currency: string, sessionId: string): Promise<void> {
  const typeEmoji: Record<string, string> = {
    discord_access: '🎁',
    wishlist_slot: '📝',
    price_tracker: '📊',
  };

  const emoji = typeEmoji[consumableType] || '🎁';
  const typeName = consumableType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const embed: DiscordEmbed = {
    title: `${emoji} Consumable Purchase`,
    description: 'A user has purchased a consumable item!',
    color: 0x0099ff, // Blue
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      {
        name: 'Type',
        value: typeName,
        inline: true,
      },
      {
        name: 'Quantity',
        value: `${quantity}`,
        inline: true,
      },
      {
        name: 'Amount',
        value: `${amount.toFixed(2)} ${currency.toUpperCase()}`,
        inline: true,
      },
      {
        name: 'Session ID',
        value: `\`${sessionId}\``,
        inline: false,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'purchases');
}

/**
 * Send notification for user ban
 */
export async function notifyUserBan(steamId: string, bannedBy?: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: '🔨 User Banned',
    description: 'A user has been banned from the platform.',
    color: 0xff0000, // Red
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      ...(bannedBy ? [{
        name: 'Banned By',
        value: `\`${bannedBy}\``,
        inline: true,
      }] : []),
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'moderation');
}

/**
 * Send notification for user unban
 */
export async function notifyUserUnban(steamId: string, unbannedBy?: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: '✅ User Unbanned',
    description: 'A user has been unbanned from the platform.',
    color: 0x00ff00, // Green
    fields: [
      {
        name: 'Steam ID',
        value: `\`${steamId}\``,
        inline: true,
      },
      ...(unbannedBy ? [{
        name: 'Unbanned By',
        value: `\`${unbannedBy}\``,
        inline: true,
      }] : []),
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'moderation');
}

/**
 * Send notification for chat report
 */
export async function notifyChatReport(
  reporterSteamId: string,
  reporterName: string,
  reportedSteamId: string,
  reportedName: string,
  reportType: 'global' | 'dm',
  reportId: string
): Promise<void> {
  const embed: DiscordEmbed = {
    title: '🚨 Chat Report Submitted',
    description: 'A new chat report has been submitted and requires review.',
    color: 0xff9900, // Orange
    fields: [
      {
        name: 'Reporter',
        value: `${reporterName}\n\`${reporterSteamId}\``,
        inline: true,
      },
      {
        name: 'Reported User',
        value: `${reportedName}\n\`${reportedSteamId}\``,
        inline: true,
      },
      {
        name: 'Report Type',
        value: reportType === 'global' ? '🌐 Global Chat' : '💬 Direct Message',
        inline: true,
      },
      {
        name: 'Report ID',
        value: `\`${reportId}\``,
        inline: false,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ],
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'reports');
}

/**
 * Send notification for item report
 */
export async function notifyItemReport(
  itemName: string,
  itemId: string,
  reason: string,
  existsInAPI: boolean,
  itemImage?: string | null
): Promise<void> {
  const embed: DiscordEmbed = {
    title: '🔍 Missing Item Report',
    description: existsInAPI 
      ? '⚠️ **Item exists in API but may have issues**'
      : '❌ **Item not found in API**',
    color: existsInAPI ? 0xffaa00 : 0xff0000,
    fields: [
      {
        name: 'Item Name',
        value: itemName || 'N/A',
        inline: true,
      },
      {
        name: 'Item ID',
        value: `\`${itemId}\``,
        inline: true,
      },
      {
        name: 'Reason',
        value: reason || 'No reason provided',
        inline: false,
      },
      {
        name: 'Status',
        value: existsInAPI ? '✅ Found in API' : '❌ Not in API',
        inline: true,
      },
      {
        name: 'Timestamp',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      },
    ],
    ...(itemImage && {
      thumbnail: {
        url: itemImage,
      },
    }),
    footer: {
      text: 'SkinVaults Notification System',
    },
    timestamp: new Date().toISOString(),
  };

  await sendDiscordWebhook([embed], 'reports');
}
