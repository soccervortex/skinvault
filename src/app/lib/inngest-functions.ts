/**
 * Inngest Functions
 * Background jobs and scheduled tasks
 */

import { inngest } from './inngest';
import { dbGet } from '@/app/utils/database';
import crypto from 'crypto';
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

/**
 * Automated X posting - posts about popular CS2 weapons
 * Runs 2-3 times per day to stay within 500 posts/month limit
 * Schedule: 10:00, 16:00, 22:00 UTC (adjust as needed)
 */
export const automatedXPosting = inngest.createFunction(
  { id: 'automated-x-posting' },
  { cron: '0 10,16,22 * * *' }, // 3 times per day: 10:00, 16:00, 22:00 UTC
  async ({ event, step }) => {
    return await step.run('check-and-post', async () => {
      try {
        // Check if X posting is enabled
        const enabled = (await dbGet<boolean>('x_posting_enabled')) || false;
        if (!enabled) {
          console.log('[X Auto Post] X posting is disabled, skipping');
          return { skipped: true, reason: 'disabled' };
        }

        // Check monthly post count (500 limit)
        const { dbGet: dbGetUtil, dbSet } = await import('@/app/utils/database');
        const postHistory = (await dbGetUtil<Array<{ date: string; postId: string; weapon: string }>>('x_posting_history')) || [];
        
        // Filter posts from current month
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const thisMonthPosts = postHistory.filter(p => p.date.startsWith(currentMonth));
        
        if (thisMonthPosts.length >= 500) {
          console.log('[X Auto Post] Monthly limit reached (500 posts), skipping');
          return { skipped: true, reason: 'monthly_limit_reached', count: thisMonthPosts.length };
        }

        // Check last post time (avoid posting too frequently)
        const lastPost = await dbGetUtil<string>('x_posting_last_post');
        if (lastPost) {
          const lastPostDate = new Date(lastPost);
          const hoursSinceLastPost = (now.getTime() - lastPostDate.getTime()) / (1000 * 60 * 60);
          
          // Minimum 4 hours between posts
          if (hoursSinceLastPost < 4) {
            console.log(`[X Auto Post] Too soon since last post (${hoursSinceLastPost.toFixed(1)}h), skipping`);
            return { skipped: true, reason: 'too_soon', hoursSince: hoursSinceLastPost };
          }
        }

        // Get a popular weapon from dataset
        const weapon = await step.run('get-weapon', async () => {
          return await getPopularWeaponFromDataset();
        });

        if (!weapon) {
          return { skipped: true, reason: 'no_weapon_found' };
        }

        // Check if we've posted about this weapon recently (avoid duplicates)
        const recentPosts = postHistory.filter(p => {
          const postDate = new Date(p.date);
          const daysSince = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince < 7; // Last 7 days
        });

        const alreadyPosted = recentPosts.some(p => p.weapon === weapon.name);
        if (alreadyPosted) {
          console.log(`[X Auto Post] Already posted about ${weapon.name} recently, skipping`);
          return { skipped: true, reason: 'duplicate', weapon: weapon.name };
        }

        // Create and post
        const postResult = await step.run('create-post', async () => {
          return await createAutomatedXPost(weapon);
        });

        if (postResult.success) {
          // Update history
          const newHistory = [
            ...postHistory,
            {
              date: now.toISOString(),
              postId: postResult.postId || 'unknown',
              weapon: weapon.name,
            },
          ];
          await dbSet('x_posting_history', newHistory);
          await dbSet('x_posting_last_post', now.toISOString());

          console.log(`[X Auto Post] Successfully posted about ${weapon.name}`);
          return {
            success: true,
            postId: postResult.postId,
            weapon: weapon.name,
            monthlyCount: thisMonthPosts.length + 1,
          };
        } else {
          console.error('[X Auto Post] Failed to create post:', postResult.error);
          return { success: false, error: postResult.error };
        }
      } catch (error: any) {
        console.error('[X Auto Post] Error:', error);
        throw error;
      }
    });
  }
);

/**
 * Get a popular weapon from the CS2 dataset
 */
async function getPopularWeaponFromDataset(): Promise<{ name: string; imageUrl: string; price: string } | null> {
  try {
    // Fetch weapons from the dataset
    const response = await fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json');
    const data = await response.json();
    
    const weapons = Array.isArray(data) ? data : Object.values(data);
    
    // Filter for popular/rare weapons (Covert, Classified, or high-value items)
    const popularWeapons = weapons.filter((w: any) => {
      const rarity = w.rarity?.name || w.rarity || '';
      return rarity.includes('Covert') || rarity.includes('Classified') || rarity.includes('Extraordinary');
    });

    if (popularWeapons.length === 0) {
      // Fallback to any weapon
      const randomWeapon = weapons[Math.floor(Math.random() * weapons.length)];
      return formatWeaponForPost(randomWeapon);
    }

    // Pick a random popular weapon
    const randomWeapon = popularWeapons[Math.floor(Math.random() * popularWeapons.length)];
    return formatWeaponForPost(randomWeapon);
  } catch (error) {
    console.error('Failed to fetch weapon dataset:', error);
    // Fallback to hardcoded popular weapons
    return getFallbackWeapon();
  }
}

/**
 * Format weapon data for posting
 */
function formatWeaponForPost(weapon: any): { name: string; imageUrl: string; price: string } {
  const name = weapon.market_hash_name || weapon.name || 'Unknown Weapon';
  const imageUrl = weapon.image || weapon.icon_url || '';
  
  // Try to get price from weapon data, or use a placeholder
  const price = weapon.price || 'Check price';
  
  return { name, imageUrl, price: typeof price === 'number' ? `€${price.toFixed(2)}` : price };
}

/**
 * Fallback weapon if dataset fetch fails
 */
function getFallbackWeapon(): { name: string; imageUrl: string; price: string } {
  const fallbackWeapons = [
    { name: 'AK-47 | Redline', imageUrl: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5gZKKkuXLPr7Vn35cppwl3r3E9t2n3gzhqUZtYz2mI4eBd1M3Y1rV-lfolOq6h8C5tJ7NnHEh7CJQ5H3D30vgzA', price: '€45.20' },
    { name: 'AWP | Asiimov', imageUrl: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5gZKKkuXLPr7Vn35cppwl3r3E9t2n3gzhqUZtYz2mI4eBd1M3Y1rV-lfolOq6h8C5tJ7NnHEh7CJQ5H3D30vgzA', price: '€89.50' },
    { name: 'M4A4 | Howl', imageUrl: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5gZKKkuXLPr7Vn35cppwl3r3E9t2n3gzhqUZtYz2mI4eBd1M3Y1rV-lfolOq6h8C5tJ7NnHEh7CJQ5H3D30vgzA', price: '€1,234.00' },
  ];
  return fallbackWeapons[Math.floor(Math.random() * fallbackWeapons.length)];
}

/**
 * Create an automated X post (without owner check)
 */
async function createAutomatedXPost(weapon: { name: string; imageUrl: string; price: string }): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      return { success: false, error: 'X API credentials not configured' };
    }

    // Import OAuth functions from the test route
    const crypto = await import('crypto');
    
    // Generate OAuth 1.0a signature
    function generateOAuthSignature(
      method: string,
      url: string,
      params: Record<string, string>,
      consumerSecret: string,
      tokenSecret: string
    ): string {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');

      const signatureBaseString = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(sortedParams),
      ].join('&');

      const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
      const signature = crypto.createHmac('sha1', signingKey)
        .update(signatureBaseString)
        .digest('base64');

      return signature;
    }

    function generateOAuthHeader(
      method: string,
      url: string,
      apiKey: string,
      apiSecret: string,
      accessToken: string,
      accessTokenSecret: string
    ): string {
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: apiKey,
        oauth_token: accessToken,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_version: '1.0',
      };

      const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
      oauthParams.oauth_signature = signature;

      const authHeader = 'OAuth ' + Object.keys(oauthParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');

      return authHeader;
    }

    const postText = `🎮 ${weapon.name}\n\n💰 Price: ${weapon.price}\n\nTrack your CS2 inventory:\nskinvaults.online\n\n#CS2 #CSGO #Skins`;

    const url = 'https://api.x.com/2/tweets';
    const body = {
      text: postText.substring(0, 280),
    };

    const authHeader = generateOAuthHeader(
      'POST',
      url,
      X_API_KEY,
      X_API_SECRET,
      X_ACCESS_TOKEN,
      X_ACCESS_TOKEN_SECRET
    );

    const postResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await postResponse.text();

    if (!postResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { detail: responseText || 'Unknown error' };
      }
      return { success: false, error: errorData.detail || errorData.title || errorData.message || 'Failed to post' };
    }

    const data = JSON.parse(responseText);
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create post' };
  }
}

