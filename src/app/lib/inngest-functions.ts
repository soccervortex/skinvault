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
 * Automated X posting - posts about ALL CS2 items (weapons, skins, stickers, agents, crates)
 * Runs at 11:15 AM Amsterdam time (10:15 UTC) - checks if post was made today, if not posts
 * Cycles through all items in the game, includes images and links to item pages
 */
export const automatedXPosting = inngest.createFunction(
  { id: 'automated-x-posting' },
  { cron: '15 10 * * *' }, // 10:15 UTC = 11:15 AM Amsterdam (CET) / 12:15 PM (CEST)
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
        const postHistory = (await dbGetUtil<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];
        
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

        // Get next item from all datasets (weapons, skins, stickers, agents, crates)
        const item = await step.run('get-item', async () => {
          return await getNextItemFromAllDatasets(postHistory);
        });

        if (!item) {
          return { skipped: true, reason: 'no_item_found' };
        }

        // Get real price from Steam API
        const priceData = await step.run('get-price', async () => {
          return await getItemPrice(item.marketHashName || item.name);
        });

        // Check if we've posted about this item recently (avoid duplicates)
        const recentPosts = postHistory.filter(p => {
          const postDate = new Date(p.date);
          const daysSince = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince < 30; // Last 30 days
        });

        const alreadyPosted = recentPosts.some(p => p.itemId === item.id || p.itemName === item.name);
        if (alreadyPosted) {
          console.log(`[X Auto Post] Already posted about ${item.name} recently, skipping`);
          return { skipped: true, reason: 'duplicate', item: item.name };
        }

        // Create item page URL
        const itemPageUrl = `https://www.skinvaults.online/item/${encodeURIComponent(item.id || item.marketHashName || item.name)}`;

        // Create and post with image
        const postResult = await step.run('create-post', async () => {
          return await createAutomatedXPostWithImage({
            ...item,
            price: priceData?.price || 'Check price',
            itemPageUrl,
          });
        });

        if (postResult.success) {
          // Update history
          const newHistory = [
            ...postHistory,
            {
              date: now.toISOString(),
              postId: postResult.postId || 'unknown',
              itemId: item.id || '',
              itemName: item.name,
              itemType: item.type || 'skin',
            },
          ];
          await dbSet('x_posting_history', newHistory);
          await dbSet('x_posting_last_post', now.toISOString());

          console.log(`[X Auto Post] Successfully posted about ${item.name} (${item.type || 'skin'})`);
          return {
            success: true,
            postId: postResult.postId,
            itemName: item.name,
            itemType: item.type || 'skin',
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
 * Get next item from ALL CS2 datasets (weapons, skins, stickers, agents, crates)
 * Cycles through all items intelligently to avoid duplicates
 */
async function getNextItemFromAllDatasets(
  postHistory: Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>
): Promise<{ id: string; name: string; marketHashName: string; imageUrl: string; type: string } | null> {
  try {
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    const datasets = [
      { url: `${BASE_URL}/skins_not_grouped.json`, type: 'skin' },
      { url: `${BASE_URL}/stickers.json`, type: 'sticker' },
      { url: `${BASE_URL}/agents.json`, type: 'agent' },
      { url: `${BASE_URL}/crates.json`, type: 'crate' },
    ];

    // Fetch all datasets
    const allItems: any[] = [];
    for (const dataset of datasets) {
      try {
        const response = await fetch(dataset.url, { next: { revalidate: 3600 } }); // Cache for 1 hour
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        // Add type to each item
        items.forEach((item: any) => {
          allItems.push({
            ...item,
            type: dataset.type,
            id: item.id || item.market_hash_name || item.name,
            name: item.market_hash_name || item.name || 'Unknown',
            marketHashName: item.market_hash_name || item.name || '',
            imageUrl: item.image || item.icon_url || item.image_url || '',
          });
        });
      } catch (error) {
        console.error(`Failed to fetch ${dataset.type} dataset:`, error);
      }
    }

    if (allItems.length === 0) {
      console.error('No items found in any dataset');
      return null;
    }

    // Filter out items we've posted about recently (last 30 days)
    const recentItemIds = new Set(postHistory.map(p => p.itemId).filter(Boolean));
    const recentItemNames = new Set(postHistory.map(p => p.itemName).filter(Boolean));
    
    const availableItems = allItems.filter(item => {
      const itemId = item.id || item.market_hash_name || item.name;
      const itemName = item.market_hash_name || item.name;
      return !recentItemIds.has(itemId) && !recentItemNames.has(itemName);
    });

    // If we've posted about everything, reset and start over
    const itemsToUse = availableItems.length > 0 ? availableItems : allItems;

    // Pick a random item (you could also implement a smarter rotation here)
    const randomItem = itemsToUse[Math.floor(Math.random() * itemsToUse.length)];

    return {
      id: randomItem.id || randomItem.market_hash_name || randomItem.name,
      name: randomItem.market_hash_name || randomItem.name || 'Unknown',
      marketHashName: randomItem.market_hash_name || randomItem.name || '',
      imageUrl: randomItem.image || randomItem.icon_url || randomItem.image_url || '',
      type: randomItem.type || 'skin',
    };
  } catch (error) {
    console.error('Failed to fetch item datasets:', error);
    return null;
  }
}

/**
 * Get real price from Steam API
 */
async function getItemPrice(marketHashName: string): Promise<{ price: string; currency: string } | null> {
  try {
    if (!marketHashName) return null;

    // Use Euro currency (code 3)
    const hash = encodeURIComponent(marketHashName);
    const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${hash}&t=${Date.now()}`;
    
    // Use a simple fetch (no proxy needed for server-side)
    const response = await fetch(steamUrl, { 
      next: { revalidate: 300 }, // Cache for 5 minutes
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.lowest_price) {
      // Clean price string (remove currency symbol, we'll add €)
      const price = data.lowest_price.replace(/[^\d,.]/g, '').replace(',', '.');
      return { price: `€${price}`, currency: 'EUR' };
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch price:', error);
    return null;
  }
}

/**
 * Create an automated X post with image (without owner check)
 */
async function createAutomatedXPostWithImage(item: { 
  name: string; 
  imageUrl: string; 
  price: string; 
  itemPageUrl: string;
  type?: string;
}): Promise<{ success: boolean; postId?: string; error?: string }> {
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

    // Create post text with item page link
    const itemTypeEmoji = item.type === 'sticker' ? '🏷️' : item.type === 'agent' ? '👤' : item.type === 'crate' ? '📦' : '🎮';
    const postText = `${itemTypeEmoji} ${item.name}\n\n💰 Price: ${item.price}\n\n🔗 View details: ${item.itemPageUrl}\n\nTrack your CS2 inventory:\nskinvaults.online\n\n#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;

    // Upload image first if available
    let mediaId: string | null = null;
    if (item.imageUrl) {
      try {
        mediaId = await uploadImageToX(item.imageUrl, X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET);
        if (!mediaId) {
          console.warn('[X Auto Post] Failed to upload image, posting without image');
        }
      } catch (error) {
        console.warn('[X Auto Post] Image upload error:', error);
        // Continue without image
      }
    }

    const url = 'https://api.x.com/2/tweets';
    const body: any = {
      text: postText.substring(0, 280),
    };

    // Add media if uploaded successfully
    if (mediaId) {
      body.media = { media_ids: [mediaId] };
    }

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

/**
 * Upload image to X API and return media_id
 * Uses X API v1.1 media/upload endpoint with OAuth 1.0a
 */
async function uploadImageToX(
  imageUrl: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string | null> {
  try {
    console.log('[X Image Upload] Downloading image from:', imageUrl);
    
    // Download image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error('[X Image Upload] Failed to download image:', imageResponse.status);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = Buffer.from(imageBuffer);
    
    // Determine content type
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    console.log('[X Image Upload] Image downloaded, size:', imageBytes.length, 'bytes, type:', contentType);

    // X API v1.1 media upload endpoint
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    
    // Generate multipart boundary
    const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
    
    // Create multipart form data with binary image
    const CRLF = '\r\n';
    const formParts: Buffer[] = [];
    
    // Add media field header
    formParts.push(Buffer.from(`--${boundary}${CRLF}`));
    formParts.push(Buffer.from(`Content-Disposition: form-data; name="media"; filename="image.${contentType.split('/')[1] || 'png'}"${CRLF}`));
    formParts.push(Buffer.from(`Content-Type: ${contentType}${CRLF}`));
    formParts.push(Buffer.from(CRLF));
    
    // Add binary image data
    formParts.push(imageBytes);
    
    // Add closing boundary
    formParts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));
    
    const multipartBuffer = Buffer.concat(formParts);

    // Generate OAuth 1.0a signature
    // For multipart requests, we only sign the OAuth parameters, not the body
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_token: accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
    };

    // Generate signature (only OAuth parameters, not multipart body)
    const sortedParams = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
      .join('&');

    const signatureBaseString = [
      'POST',
      encodeURIComponent(uploadUrl),
      encodeURIComponent(sortedParams),
    ].join('&');

    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
    const signature = crypto.createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    // Build authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    // Upload media
    console.log('[X Image Upload] Uploading to X API...');
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBuffer,
    });

    const responseText = await uploadResponse.text();
    console.log('[X Image Upload] Upload response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      console.error('[X Image Upload] Upload failed:', responseText);
      return null;
    }

    let uploadData;
    try {
      uploadData = JSON.parse(responseText);
    } catch {
      console.error('[X Image Upload] Failed to parse response:', responseText);
      return null;
    }

    const mediaId = uploadData.media_id_string || uploadData.media_id;
    if (mediaId) {
      console.log('[X Image Upload] Success! Media ID:', mediaId);
      return mediaId.toString();
    }

    console.error('[X Image Upload] No media_id in response:', uploadData);
    return null;
  } catch (error: any) {
    console.error('[X Image Upload] Error:', error);
    return null;
  }
}

/**
 * Check if we already posted today by checking X API profile
 */
async function checkIfPostedTodayOnX(): Promise<boolean> {
  try {
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      return false; // If no credentials, assume no post
    }

    // Generate OAuth header helper
    function generateOAuthHeader(method: string, url: string): string {
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: X_API_KEY!,
        oauth_token: X_ACCESS_TOKEN!,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_version: '1.0',
      };

      const sortedParams = Object.keys(oauthParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
        .join('&');

      const signatureBaseString = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(sortedParams),
      ].join('&');

      const signingKey = `${encodeURIComponent(X_API_SECRET!)}&${encodeURIComponent(X_ACCESS_TOKEN_SECRET!)}`;
      const signature = crypto.createHmac('sha1', signingKey)
        .update(signatureBaseString)
        .digest('base64');

      oauthParams.oauth_signature = signature;

      return 'OAuth ' + Object.keys(oauthParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');
    }

    // Get user ID
    const userUrl = 'https://api.x.com/2/users/me';
    const userAuthHeader = generateOAuthHeader('GET', userUrl);
    
    const userResponse = await fetch(userUrl, {
      headers: { 'Authorization': userAuthHeader },
    });

    if (!userResponse.ok) {
      console.warn('[X Check] Failed to get user ID');
      return false;
    }

    const userData = await userResponse.json();
    const userId = userData.data?.id;

    if (!userId) {
      return false;
    }

    // Get recent tweets (last 10)
    const tweetsUrl = `https://api.x.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at`;
    const tweetsAuthHeader = generateOAuthHeader('GET', tweetsUrl);
    
    const tweetsResponse = await fetch(tweetsUrl, {
      headers: { 'Authorization': tweetsAuthHeader },
    });

    if (!tweetsResponse.ok) {
      console.warn('[X Check] Failed to get tweets');
      return false;
    }

    const tweetsData = await tweetsResponse.json();
    const tweets = tweetsData.data || [];

    // Check if any tweet was posted today
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const tweet of tweets) {
      const tweetDate = new Date(tweet.created_at);
      const tweetDay = new Date(tweetDate.getFullYear(), tweetDate.getMonth(), tweetDate.getDate());
      
      if (tweetDay.getTime() === today.getTime()) {
        console.log('[X Check] Found tweet posted today:', tweet.id, tweet.text?.substring(0, 50));
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[X Check] Error checking X API:', error);
    return false; // If check fails, allow posting
  }
}

