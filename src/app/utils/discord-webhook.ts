/**
 * Discord Webhook Utility
 * Centralized service for sending notifications to Discord with category-specific channels
 */

// Webhook categories - each can have its own Discord channel
export type WebhookCategory = 
  | 'users'           // New user registrations
  | 'pro'             // Pro grants (admin) and purchases
  | 'purchases'       // All purchases (Pro and consumables)
  | 'moderation'      // User bans/unbans
  | 'reports';        // Chat and item reports

// Default webhook URLs (can be overridden by environment variables)
const DEFAULT_WEBHOOKS: Record<WebhookCategory, string> = {
  users: 'https://discord.com/api/webhooks/1455368741062967327/FP9ky0VAlS0mptl5R8c4S5_SGCwfkTqe6rw0As7Ejq5xjvoBc3-AxUQZelEzQ0sOTonc',
  pro: 'https://discord.com/api/webhooks/1455368871564415142/M_aHYhMBAnCO0AW7MP023FN1ZBskivJfJ0iu7M78wAplgw7ooDC4vl8F6M4f_xMj5hQx',
  purchases: 'https://discord.com/api/webhooks/1455369022769074432/iz6AU1xg1bHRddES_zQZ9ZsV3_FNko4vZR2-uAi8pSxkmD_9RSURN6CXNjaQfI9cW7xL',
  moderation: 'https://discord.com/api/webhooks/1455369157129277686/8XumBuRF7bxbZVW2rsEhv9zAEHmSjiqypP0aT8kk8DxDJrimyBTt5Rgr9WYJPB1vYLpi',
  reports: 'https://discord.com/api/webhooks/1455369270765682698/IzYE6FYJCyXzZJyiuqKDThW3B9daqc9KJkGFm29hyGW9xfBUCAtQCoHNaJ_v0a3Pka0H',
};

const DEFAULT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1455365997094633606/v8N3tDRUekgyGtsquJ8HhXkX2kMVxycoZJLgilvNtLV6TEFsUFUwxJ8YE5Girk5ENdUa';

// Get webhook URL for a specific category
function getWebhookUrl(category: WebhookCategory): string | null {
  // Check for category-specific webhook URLs in environment variables first
  const envVar = `DISCORD_WEBHOOK_${category.toUpperCase()}`;
  const categoryUrl = process.env[envVar];
  
  if (categoryUrl) {
    return categoryUrl;
  }
  
  // Use default webhook for this category
  if (DEFAULT_WEBHOOKS[category]) {
    return DEFAULT_WEBHOOKS[category];
  }
  
  // Final fallback to general webhook
  return process.env.DISCORD_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
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
    
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds }),
    });
  } catch (error) {
    console.error(`Failed to send Discord webhook for ${category}:`, error);
    // Don't throw - webhook failures shouldn't break the main flow
  }
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

  await sendDiscordWebhook([embed], 'users');
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
