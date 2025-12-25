/**
 * X Post Types and Content Generation
 * Different types of posts for different days/times
 */

import { dbGet, dbSet } from '@/app/utils/database';
import { getNextItemFromAllDatasets, getItemPrice, createAutomatedXPostWithImage } from '@/app/lib/inngest-functions';
import crypto from 'crypto';

export type PostType = 'weekly_summary' | 'monthly_stats' | 'item_highlight' | 'milestone' | 'alert';

interface PostContext {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  hour: number;
  dayOfMonth: number;
  isFirstOfMonth: boolean;
}

/**
 * Determine what type of post to make based on current date/time
 */
export function determinePostType(context: PostContext): PostType {
  const { dayOfWeek, hour, isFirstOfMonth } = context;

  // 1st of the month at 9 AM = Monthly stats
  if (isFirstOfMonth && hour === 9) {
    return 'monthly_stats';
  }

  // Monday or Sunday at 8 PM = Weekly summary
  if ((dayOfWeek === 1 || dayOfWeek === 0) && hour === 20) {
    return 'weekly_summary';
  }

  // Tuesday-Saturday: Check for milestones/alerts first
  if (dayOfWeek >= 2 && dayOfWeek <= 6) {
    // Check if there are any milestones or alerts
    // For now, fall back to item highlight
    return 'item_highlight';
  }

  // Default: Regular item highlight
  return 'item_highlight';
}

/**
 * Create weekly summary post
 */
export async function createWeeklySummaryPost(): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Get stats from database
    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];
    
    // Get posts from last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentPosts = postHistory.filter(p => new Date(p.date) >= sevenDaysAgo);

    // Count by type
    const typeCounts: Record<string, number> = {};
    recentPosts.forEach(p => {
      typeCounts[p.itemType] = (typeCounts[p.itemType] || 0) + 1;
    });

    // Get most popular item type
    const mostPopularType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    
    const summaryText = `📊 Weekly CS2 Market Summary\n\n` +
      `📈 Posts this week: ${recentPosts.length}\n` +
      `🎮 Most featured: ${mostPopularType ? `${mostPopularType[0]} (${mostPopularType[1]}x)` : 'N/A'}\n\n` +
      `Track your CS2 inventory:\nskinvaults.online\n\n` +
      `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;

    // Post the summary
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      return { success: false, error: 'X API credentials not configured' };
    }

    // Generate OAuth header
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: X_API_KEY,
      oauth_token: X_ACCESS_TOKEN,
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
      'POST',
      encodeURIComponent('https://api.x.com/2/tweets'),
      encodeURIComponent(sortedParams),
    ].join('&');

    const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_TOKEN_SECRET)}`;
    const signature = crypto.createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: summaryText.substring(0, 280),
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { detail: responseText || 'Unknown error' };
      }
      return { success: false, error: errorData.detail || errorData.title || 'Failed to post' };
    }

    const data = JSON.parse(responseText);
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create weekly summary' };
  }
}

/**
 * Create monthly stats post
 */
export async function createMonthlyStatsPost(): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];
    
    // Get posts from last month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPosts = postHistory.filter(p => new Date(p.date) >= lastMonth && new Date(p.date) < new Date(now.getFullYear(), now.getMonth(), 1));

    // Count by type
    const typeCounts: Record<string, number> = {};
    lastMonthPosts.forEach(p => {
      typeCounts[p.itemType] = (typeCounts[p.itemType] || 0) + 1;
    });

    const totalPosts = lastMonthPosts.length;
    const mostPopularType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

    const statsText = `📊 Monthly CS2 Market Stats\n\n` +
      `📈 Total posts: ${totalPosts}\n` +
      `🎮 Top category: ${mostPopularType ? `${mostPopularType[0]} (${mostPopularType[1]}x)` : 'N/A'}\n` +
      `📅 Month: ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}\n\n` +
      `Track your CS2 inventory:\nskinvaults.online\n\n` +
      `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;

    // Post the stats (same OAuth logic as weekly summary)
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      return { success: false, error: 'X API credentials not configured' };
    }

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: X_API_KEY,
      oauth_token: X_ACCESS_TOKEN,
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
      'POST',
      encodeURIComponent('https://api.x.com/2/tweets'),
      encodeURIComponent(sortedParams),
    ].join('&');

    const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_TOKEN_SECRET)}`;
    const signature = crypto.createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: statsText.substring(0, 280),
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { detail: responseText || 'Unknown error' };
      }
      return { success: false, error: errorData.detail || errorData.title || 'Failed to post' };
    }

    const data = JSON.parse(responseText);
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create monthly stats' };
  }
}

/**
 * Create regular item highlight post (default)
 */
export async function createItemHighlightPost(
  postHistory: Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>
): Promise<{ success: boolean; postId?: string; error?: string; itemName?: string }> {
  try {
    // Get next item from all datasets
    const item = await getNextItemFromAllDatasets(postHistory);

    if (!item) {
      return { success: false, error: 'No item found for posting' };
    }

    // Get real price from Steam API
    const priceData = await getItemPrice(item.marketHashName || item.name);

    // Create item page URL
    const itemPageUrl = `https://www.skinvaults.online/item/${encodeURIComponent(item.id || item.marketHashName || item.name)}`;

    // Create and post with image
    const postResult = await createAutomatedXPostWithImage({
      name: item.name,
      imageUrl: item.imageUrl,
      price: priceData?.price || 'Check price',
      itemPageUrl,
    });

    if (postResult.success) {
      return { 
        success: true, 
        postId: postResult.postId,
        itemName: item.name,
      };
    } else {
      return { success: false, error: postResult.error };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create item highlight post' };
  }
}

/**
 * Check for milestones or alerts (for future implementation)
 */
export async function checkForMilestonesOrAlerts(): Promise<{ hasMilestone: boolean; milestone?: any }> {
  // TODO: Implement milestone checking
  // Examples:
  // - User count milestones (1000, 5000, 10000 users)
  // - Price alerts (significant price changes)
  // - Feature announcements
  return { hasMilestone: false };
}

