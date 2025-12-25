/**
 * X Post Types and Content Generation
 * Different types of posts for different days/times
 */

import { dbGet, dbSet } from '@/app/utils/database';
import { getNextItemFromAllDatasets, getItemPrice, createAutomatedXPostWithImage } from '@/app/lib/inngest-functions';
import { getTopMovers, getTrendingItems, PriceChange } from '@/app/lib/price-tracking';
import { checkUserCountMilestone, getUnpostedMilestones, markMilestonePosted, UserMilestone } from '@/app/lib/user-milestones';
import { getUnpostedFeatureAnnouncements, markFeatureAnnouncementPosted, FeatureAnnouncement } from '@/app/lib/feature-announcements';
import { getUnpostedNewUsers, createNewUserWelcomePost, NewUser } from '@/app/lib/new-user-posts';
import crypto from 'crypto';

export type PostType = 'weekly_summary' | 'monthly_stats' | 'item_highlight' | 'milestone' | 'alert' | 'new_user';

interface PostContext {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  hour: number;
  minute: number;
  dayOfMonth: number;
  isFirstOfMonth: boolean;
}

/**
 * Determine what type of post to make based on current date/time
 * Optimized for best X (Twitter) posting times:
 * - Monday: 9 AM - 8 PM
 * - Tuesday: 11 AM - 5 PM (best day)
 * - Wednesday: 10 AM - 5 PM (best day)
 * - Thursday: 10 AM - 5 PM (best day)
 * - Friday: 10 AM - 5 PM
 * - Saturday: 11 AM - 2 PM (worst day)
 * - Sunday: 2 PM - 6 PM (worst day)
 */
export function determinePostType(context: PostContext): PostType {
  const { dayOfWeek, hour, minute, isFirstOfMonth } = context;

  // Monthly stats: 1st of the month
  // If 1st falls on Tuesday-Thursday (best days), post at 11 AM (10:00 UTC)
  // Otherwise, post at 9 AM (8:00 UTC) as fallback
  if (isFirstOfMonth) {
    if (dayOfWeek >= 2 && dayOfWeek <= 4 && hour === 10 && minute === 0) {
      // Best days: Tuesday-Thursday at 11 AM
      return 'monthly_stats';
    } else if (hour === 8 && minute === 0) {
      // Fallback: Other days at 9 AM
      return 'monthly_stats';
    }
  }

  // Weekly summary: Monday or Sunday at 8 PM (19:00 UTC)
  // Monday 8 PM is within best times (9 AM - 8 PM)
  // Sunday 8 PM is outside best times (2 PM - 6 PM), but we keep it for consistency
  if ((dayOfWeek === 1 || dayOfWeek === 0) && hour === 19 && minute === 0) {
    return 'weekly_summary';
  }

  // Daily item highlights - optimized per day
  // Monday: 11 AM (10:00 UTC) - within 9 AM - 8 PM
  if (dayOfWeek === 1 && hour === 10 && minute === 0) {
    return 'item_highlight';
  }

  // Tuesday: 11 AM (10:00 UTC) - BEST DAY, within 11 AM - 5 PM
  if (dayOfWeek === 2 && hour === 10 && minute === 0) {
    return 'item_highlight';
  }

  // Wednesday: 11 AM (10:00 UTC) - BEST DAY, within 10 AM - 5 PM
  if (dayOfWeek === 3 && hour === 10 && minute === 0) {
    return 'item_highlight';
  }

  // Thursday: 11 AM (10:00 UTC) - BEST DAY, within 10 AM - 5 PM
  if (dayOfWeek === 4 && hour === 10 && minute === 0) {
    return 'item_highlight';
  }

  // Friday: 11 AM (10:00 UTC) - within 10 AM - 5 PM
  if (dayOfWeek === 5 && hour === 10 && minute === 0) {
    return 'item_highlight';
  }

  // Saturday: 11 AM (10:00 UTC) - WORST DAY, but within 11 AM - 2 PM
  if (dayOfWeek === 6 && hour === 10 && minute === 0) {
    return 'item_highlight';
  }

  // Sunday: 2 PM (13:00 UTC) - WORST DAY, but within 2 PM - 6 PM
  // Changed from 11 AM to 2 PM to be within best times
  if (dayOfWeek === 0 && hour === 13 && minute === 0) {
    return 'item_highlight';
  }

  // Retry times (if first attempt fails)
  // Monday-Saturday: 11:30 AM (10:30 UTC)
  if (dayOfWeek >= 1 && dayOfWeek <= 6 && hour === 10 && minute === 30) {
    return 'item_highlight';
  }

  // Sunday retry: 2:30 PM (13:30 UTC) - within 2 PM - 6 PM
  if (dayOfWeek === 0 && hour === 13 && minute === 30) {
    return 'item_highlight';
  }

  // Default: No post (outside optimal times)
  return 'item_highlight';
}

/**
 * Create weekly summary post with top movers
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
    
    // Get top 5 movers (gainers and losers) from last 7 days
    const { gainers, losers } = await getTopMovers('7d', 5);
    
    let summaryText = `📊 Weekly CS2 Market Summary\n\n`;
    summaryText += `📈 Posts this week: ${recentPosts.length}\n`;
    summaryText += `🎮 Most featured: ${mostPopularType ? `${mostPopularType[0]} (${mostPopularType[1]}x)` : 'N/A'}\n\n`;
    
    // Add top gainers
    if (gainers.length > 0) {
      summaryText += `📈 Top Gainers (7d):\n`;
      gainers.slice(0, 3).forEach((item, idx) => {
        summaryText += `${idx + 1}. ${item.marketHashName}: +${item.changePercent.toFixed(1)}%\n`;
      });
      summaryText += `\n`;
    }
    
    // Add top losers
    if (losers.length > 0) {
      summaryText += `📉 Top Losers (7d):\n`;
      losers.slice(0, 3).forEach((item, idx) => {
        summaryText += `${idx + 1}. ${item.marketHashName}: ${item.changePercent.toFixed(1)}%\n`;
      });
      summaryText += `\n`;
    }
    
    summaryText += `Track your CS2 inventory:\nskinvaults.online\n\n`;
    summaryText += `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;

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
 * Check for trending items or price alerts
 */
export async function checkForMilestonesOrAlerts(): Promise<{ hasMilestone: boolean; milestone?: any; shouldPost?: boolean }> {
  try {
    // Check for trending items (>15% change in 24h)
    const trending = await getTrendingItems(15, '24h', 5);
    
    if (trending.length > 0) {
      // Get the most significant change
      const topTrend = trending[0];
      
      // Check if we've already posted about this item today
      const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];
      const today = new Date().toISOString().split('T')[0];
      const postedToday = postHistory.some(p => {
        const postDate = p.date.split('T')[0];
        return postDate === today && (p.itemName === topTrend.marketHashName || p.itemId === topTrend.marketHashName);
      });

      if (!postedToday) {
        return {
          hasMilestone: true,
          milestone: {
            type: 'trending_alert',
            item: topTrend,
            message: topTrend.isIncrease
              ? `🚨 ALERT: ${topTrend.marketHashName} +${topTrend.changePercent.toFixed(1)}% in 24h! Current: €${topTrend.currentPrice.toFixed(2)}`
              : `📉 ALERT: ${topTrend.marketHashName} ${topTrend.changePercent.toFixed(1)}% in 24h! Current: €${topTrend.currentPrice.toFixed(2)}`,
          },
          shouldPost: true,
        };
      }
    }

    // Check for new users (priority: post about new users if available)
    console.log('[X Post Types] Checking for new users...');
    const unpostedNewUsers = await getUnpostedNewUsers();
    console.log('[X Post Types] Found unposted new users:', unpostedNewUsers.length);
    if (unpostedNewUsers.length > 0) {
      const newUser = unpostedNewUsers[0]; // Post about the oldest unposted user
      console.log('[X Post Types] Returning new user milestone:', newUser.steamId, newUser.steamName);
      return {
        hasMilestone: true,
        shouldPost: true,
        milestone: {
          type: 'new_user',
          user: newUser,
        },
      };
    }

    return { hasMilestone: false };
  } catch (error) {
    console.error('Failed to check for milestones/alerts:', error);
    return { hasMilestone: false };
  }
}

/**
 * Create new user welcome post
 */
export async function createNewUserPost(user: NewUser): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const result = await createNewUserWelcomePost(user);
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create new user post' };
  }
}

/**
 * Create feature announcement post
 */
export async function createFeatureAnnouncementPost(announcement: FeatureAnnouncement): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const linkText = announcement.link ? `\n\n🔗 ${announcement.link}` : '';
    const announcementText = `✨ New: ${announcement.title}\n\n` +
      `${announcement.description}${linkText}\n\n` +
      `Track your CS2 inventory:\nskinvaults.online\n\n` +
      `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;

    // Post the announcement (same OAuth logic)
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
        text: announcementText.substring(0, 280),
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
    
    // Mark announcement as posted
    if (data.data?.id) {
      await markFeatureAnnouncementPosted(announcement.id, data.data.id);
    }
    
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create feature announcement post' };
  }
}

/**
 * Create user milestone post
 */
export async function createUserMilestonePost(milestone: UserMilestone): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    let milestoneText = '';
    
    if (milestone.type === 'user_count') {
      milestoneText = `🎉 Milestone Reached!\n\n` +
        `We now have ${milestone.value.toLocaleString()} users on SkinVaults! 🚀\n\n` +
        `Thank you to everyone who trusts us to track their CS2 inventory.\n\n` +
        `Track your CS2 inventory:\nskinvaults.online\n\n` +
        `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;
    } else {
      milestoneText = `🎉 Milestone Reached!\n\n` +
        `Thank you for being part of the SkinVaults community! 🚀\n\n` +
        `Track your CS2 inventory:\nskinvaults.online\n\n` +
        `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;
    }

    // Post the milestone (same OAuth logic)
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
        text: milestoneText.substring(0, 280),
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
    
    // Mark milestone as posted
    if (data.data?.id) {
      await markMilestonePosted(milestone, data.data.id);
    }
    
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create user milestone post' };
  }
}

/**
 * Create trending alert post
 */
export async function createTrendingAlertPost(priceChange: PriceChange): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const emoji = priceChange.isIncrease ? '🚨' : '📉';
    const sign = priceChange.isIncrease ? '+' : '';
    const itemPageUrl = `https://www.skinvaults.online/item/${encodeURIComponent(priceChange.marketHashName)}`;
    
    const alertText = `${emoji} ALERT: ${priceChange.marketHashName}\n\n` +
      `${sign}${priceChange.changePercent.toFixed(1)}% in 24h\n` +
      `💰 Current: €${priceChange.currentPrice.toFixed(2)}\n` +
      `📊 Previous: €${priceChange.previousPrice.toFixed(2)}\n\n` +
      `🔗 View: ${itemPageUrl}\n\n` +
      `Track your CS2 inventory:\nskinvaults.online\n\n` +
      `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;

    // Post the alert (same OAuth logic as weekly summary)
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
        text: alertText.substring(0, 280),
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
    return { success: false, error: error.message || 'Failed to create trending alert post' };
  }
}

