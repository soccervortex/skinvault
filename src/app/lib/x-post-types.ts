/**
 * X Post Types and Content Generation
 * Different types of posts for different days/times
 */

import { dbGet, dbSet } from '@/app/utils/database';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getNextItemFromAllDatasets, getItemPrice, createAutomatedXPostWithImage, createXPostWithImages } from '@/app/lib/inngest-functions';
import { getTopMovers, getTrendingItems, PriceChange } from '@/app/lib/price-tracking';
import { checkUserCountMilestone, getUnpostedMilestones, markMilestonePosted, UserMilestone } from '@/app/lib/user-milestones';
import { getUnpostedFeatureAnnouncements, markFeatureAnnouncementPosted, FeatureAnnouncement } from '@/app/lib/feature-announcements';
import { getUnpostedNewUsers, createNewUserWelcomePost, NewUser } from '@/app/lib/new-user-posts';
import crypto from 'crypto';

export type PostType = 'weekly_summary' | 'monthly_stats' | 'giveaways_digest' | 'item_highlight' | 'milestone' | 'alert' | 'new_user';

function formatPostTypeLabel(type: string): string {
  return type === 'item_highlight' ? 'Item Highlights' :
         type === 'weekly_summary' ? 'Weekly Summaries' :
         type === 'monthly_stats' ? 'Monthly Stats' :
         type === 'giveaways_digest' ? 'Giveaways' :
         type === 'daily_summary' ? 'Daily Summaries' :
         type === 'new_user' ? 'New Users' :
         type === 'milestone' ? 'Milestones' :
         type === 'alert' ? 'Alerts' :
         type;
}

function extractWeaponFromItemName(name: string): string {
  // Example:
  // "🎮 ★ StatTrak™ Shadow Daggers | Autotronic (Factory New)"
  // -> "Shadow Daggers"
  const raw = String(name || '').trim();
  if (!raw) return '';

  const withoutEmoji = raw.replace(/^🎮\s*/g, '');
  const left = withoutEmoji.includes('|') ? withoutEmoji.split('|')[0] : withoutEmoji;
  const cleaned = left
    .replace(/[★☆]/g, '')
    .replace(/StatTrak™/gi, '')
    .replace(/Souvenir/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Exclude non-weapon item categories that commonly appear in item highlights.
  const normalized = cleaned.toLowerCase();
  const nonWeapons = [
    'sticker',
    'patch',
    'graffiti',
    'music kit',
    'agent',
    'collectible',
    'case',
    'key',
    'capsule',
    'souvenir package',
    'pin',
    'storage unit',
    'name tag',
    'tag',
    'ticket',
    'pass',
    'charm',
  ];
  if (nonWeapons.some((t) => normalized === t || normalized.startsWith(`${t} `))) return '';

  return cleaned;
}

function topEntryText(counts: Record<string, number>, maxLabelLen: number = 34): string {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return 'N/A';
  const label = top[0].length > maxLabelLen ? `${top[0].slice(0, Math.max(0, maxLabelLen - 3))}...` : top[0];
  return `${label} (${top[1]}x)`;
}

function topEntryKey(counts: Record<string, number>): string {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] || '';
}

function itemUrlFromId(itemId: string): string {
  const id = String(itemId || '').trim();
  if (!id) return '';
  return `https://skinvaults.online/item/${encodeURIComponent(id)}`;
}

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

  const digestHour = dayOfWeek === 0 ? 13 : 10;
  if (hour === digestHour && (minute === 0 || minute === 30)) {
    return 'giveaways_digest';
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

  return 'item_highlight';
}

type GiveawayDigestRow = {
  id: string;
  title: string;
  prize: string;
  prizeItem?: { name?: string; image?: string | null } | null;
  startAt?: Date;
  endAt?: Date;
  creditsPerEntry: number;
};

function giveawayCadenceLabel(g: GiveawayDigestRow): 'DAILY' | 'WEEKLY' | 'MONTHLY' {
  const end = g.endAt ? new Date(g.endAt).getTime() : 0;
  const start = g.startAt ? new Date(g.startAt).getTime() : 0;
  const diffDays = start && end ? Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24))) : 0;
  if (diffDays >= 27) return 'MONTHLY';
  if (diffDays >= 6) return 'WEEKLY';
  return 'DAILY';
}

function formatEndsShort(d: Date): string {
  const dt = new Date(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mm = months[dt.getUTCMonth()] || '';
  const dd = dt.getUTCDate();
  return `${mm} ${dd}`;
}

function formatCreditsShort(value: number): string {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v >= 1_000_000) {
    const m = Math.round((v / 1_000_000) * 10) / 10;
    return String(m).replace(/\.0$/, '') + 'm';
  }
  if (v >= 10_000) {
    return String(Math.round(v / 1_000)) + 'k';
  }
  if (v >= 1_000) {
    const k = Math.round((v / 1_000) * 10) / 10;
    return String(k).replace(/\.0$/, '') + 'k';
  }
  return String(Math.round(v));
}

export async function createGiveawaysDigestPost(): Promise<{ success: boolean; postId?: string; error?: string; itemName?: string }> {
  try {
    const now = new Date();
    const db = await getDatabase();
    const col = db.collection('giveaways');

    const rows = (await col
      .find(
        {
          archivedAt: { $exists: false },
          startAt: { $lte: now },
          endAt: { $gt: now },
          drawnAt: { $exists: false },
        },
        { projection: { description: 0 } }
      )
      .sort({ endAt: 1 })
      .limit(10)
      .toArray()) as any[];

    const active = rows.map((g: any) => {
      const startAt = g.startAt ? new Date(g.startAt) : null;
      const endAt = g.endAt ? new Date(g.endAt) : null;
      return {
        id: String(g._id),
        title: String(g.title || ''),
        prize: String(g.prize || ''),
        prizeItem: g.prizeItem
          ? {
              name: String(g.prizeItem?.name || g.prizeItem?.market_hash_name || ''),
              image: g.prizeItem?.image ? String(g.prizeItem.image) : null,
            }
          : null,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        creditsPerEntry: Number(g.creditsPerEntry || 10),
      } satisfies GiveawayDigestRow;
    });

    if (active.length === 0) {
      return { success: false, error: 'No active giveaways' };
    }

    const link = 'https://www.skinvaults.online/giveaways';

    const primary = active[0];
    const primaryPrize = String(primary.prizeItem?.name || primary.prize || primary.title || '').trim();
    const primaryCadence = giveawayCadenceLabel(primary);
    const primaryEnds = primary.endAt ? formatEndsShort(primary.endAt) : '';
    const primaryEntry = formatCreditsShort(primary.creditsPerEntry);
    const hashtag = '\n#CS2 #CS2Skins #Giveaway #SkinVaults #CS2Giveaway';

    let text = '';
    if (active.length === 1) {
      const line1 = primaryPrize ? `🎁 WIN ${primaryPrize}` : '🎁 GIVEAWAY LIVE';
      const line2Parts = [
        `[${primaryCadence}]`,
        primaryEnds ? `Ends ${primaryEnds}` : '',
        primaryEntry ? `Entry ${primaryEntry} credits` : '',
      ].filter(Boolean);
      const line2 = line2Parts.join(' • ');
      text = `${line1}\n${line2}\n\nEnter now → ${link}${hashtag}`;
      if (text.length > 280) {
        text = `🎁 GIVEAWAY LIVE\n\nEnter now → ${link}${hashtag}`;
      }
    } else {
      const header = `🎁 GIVEAWAYS LIVE\nEnter now → ${link}\n\n`;
      let body = '';
      for (let i = 0; i < active.length; i++) {
        const g = active[i];
        const cadence = giveawayCadenceLabel(g);
        const prizeName = String(g.prizeItem?.name || g.prize || g.title || '').trim();
        const ends = g.endAt ? formatEndsShort(g.endAt) : '';
        const entry = formatCreditsShort(g.creditsPerEntry);
        const bits = [
          `${i + 1}) [${cadence}] ${prizeName}`,
          ends ? `Ends ${ends}` : '',
          entry ? `Entry ${entry}` : '',
        ].filter(Boolean);
        const line = bits.join(' • ') + '\n';
        if ((header + body + line + hashtag).length > 280) break;
        body += line;
      }
      text = header + body.trimEnd() + hashtag;
    }

    const imageUrls = active
      .map((g) => String(g.prizeItem?.image || '').trim())
      .filter(Boolean)
      .slice(0, 1);

    const postResult = await createXPostWithImages({
      text,
      imageUrls,
    });

    if (!postResult.success) {
      return { success: false, error: postResult.error || 'Failed to post giveaways digest' };
    }

    const itemName = active.map((g) => String(g.prizeItem?.name || g.prize || g.title || '').trim()).filter(Boolean).slice(0, 3).join(' | ');
    return { success: true, postId: postResult.postId, itemName: itemName || 'Giveaways Digest' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create giveaways digest' };
  }
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

    const highlightPosts = recentPosts.filter((p) => p.itemType === 'item_highlight' && p.itemName && p.itemName !== p.itemType);
    const skinIdCounts: Record<string, number> = {};
    const skinNameById: Record<string, string> = {};
    highlightPosts.forEach((p) => {
      const id = String(p.itemId || '').trim();
      const name = String(p.itemName || '').trim();
      if (!id || !name) return;
      skinIdCounts[id] = (skinIdCounts[id] || 0) + 1;
      if (!skinNameById[id]) skinNameById[id] = name;
    });

    const typeCounts: Record<string, number> = {};
    recentPosts.forEach(p => {
      typeCounts[p.itemType] = (typeCounts[p.itemType] || 0) + 1;
    });

    const topSkinId = topEntryKey(skinIdCounts);
    const topSkinName = topSkinId ? (skinNameById[topSkinId] || '') : '';
    const topSkinText = topSkinId ? topEntryText({ [topSkinName]: skinIdCounts[topSkinId] }, 38) : 'N/A';
    const topSkinUrl = topSkinId ? itemUrlFromId(topSkinId) : '';

    const mostPopularType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const topCategoryText = mostPopularType ? `${formatPostTypeLabel(mostPopularType[0])} (${mostPopularType[1]}x)` : 'N/A';
    
    // Get top 5 movers (gainers and losers) from last 7 days
    const { gainers, losers } = await getTopMovers('7d', 5);
    
    let summaryText = `📊 Weekly CS2 Market Summary\n\n`;
    summaryText += `📈 Posts this week: ${recentPosts.length}\n`;
    summaryText += `🎮 Top skin: ${topSkinText}\n`;
    if (topSkinUrl) summaryText += `🔗 ${topSkinUrl}\n`;
    summaryText += `🗂️ Top category: ${topCategoryText}\n\n`;
    
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
    
    summaryText += `Track your CS2 inventory:\nhttps://skinvaults.online\n\n`;
    summaryText += `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins\n@counterstrike`;

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
    const monthStart = lastMonth;
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthPosts = postHistory.filter(p => new Date(p.date) >= monthStart && new Date(p.date) < monthEnd);

    const highlightPosts = lastMonthPosts.filter((p) => p.itemType === 'item_highlight' && p.itemName && p.itemName !== p.itemType);

    const skinIdCounts: Record<string, number> = {};
    const skinNameById: Record<string, string> = {};
    highlightPosts.forEach((p) => {
      const id = String(p.itemId || '').trim();
      const name = String(p.itemName || '').trim();
      if (!id || !name) return;
      skinIdCounts[id] = (skinIdCounts[id] || 0) + 1;
      if (!skinNameById[id]) skinNameById[id] = name;
    });

    // Top weapon (derived from itemName)
    const weaponCounts: Record<string, number> = {};
    highlightPosts.forEach((p) => {
      const weapon = extractWeaponFromItemName(p.itemName);
      if (!weapon) return;
      weaponCounts[weapon] = (weaponCounts[weapon] || 0) + 1;
    });

    // Count by type
    const typeCounts: Record<string, number> = {};
    lastMonthPosts.forEach(p => {
      typeCounts[p.itemType] = (typeCounts[p.itemType] || 0) + 1;
    });

    const totalPosts = lastMonthPosts.length;
    const topSkinId = topEntryKey(skinIdCounts);
    const topSkinName = topSkinId ? (skinNameById[topSkinId] || '') : '';
    const topSkinText = topSkinId ? topEntryText({ [topSkinName]: skinIdCounts[topSkinId] }, 38) : 'N/A';
    const topSkinUrl = topSkinId ? itemUrlFromId(topSkinId) : '';
    const topWeaponText = Object.keys(weaponCounts).length ? topEntryText(weaponCounts, 28) : 'N/A';
    const mostPopularType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const topCategoryText = mostPopularType ? `${formatPostTypeLabel(mostPopularType[0])} (${mostPopularType[1]}x)` : 'N/A';

    const statsText = `📊 Monthly CS2 Market Stats\n\n` +
      `📈 Total posts: ${totalPosts}\n` +
      `🎮 Top skin: ${topSkinText}\n` +
      (topSkinUrl ? `🔗 ${topSkinUrl}\n` : '') +
      `🔫 Top weapon: ${topWeaponText}\n` +
      (topSkinText === 'N/A' ? `🗂️ Top category: ${topCategoryText}\n` : '') +
      `📅 Month: ${lastMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}\n\n` +
      `Track your CS2 inventory:\nhttps://skinvaults.online\n\n` +
      `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins\n@counterstrike`;

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
 * Create test post (for testing posting functionality)
 */
export async function createTestPost(
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
    return { success: false, error: error.message || 'Failed to create test post' };
  }
}

/**
 * Create daily summary post with today's stats
 */
export async function createDailySummaryPost(): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Get stats from database
    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];
    
    // Get posts from today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayPosts = postHistory.filter(p => new Date(p.date) >= todayStart);

    const highlightPosts = todayPosts.filter((p) => p.itemType === 'item_highlight' && p.itemName && p.itemName !== p.itemType);

    const skinIdCounts: Record<string, number> = {};
    const skinNameById: Record<string, string> = {};
    highlightPosts.forEach((p) => {
      const id = String(p.itemId || '').trim();
      const name = String(p.itemName || '').trim();
      if (!id || !name) return;
      skinIdCounts[id] = (skinIdCounts[id] || 0) + 1;
      if (!skinNameById[id]) skinNameById[id] = name;
    });

    // Top weapon
    const weaponCounts: Record<string, number> = {};
    highlightPosts.forEach((p) => {
      const weapon = extractWeaponFromItemName(p.itemName);
      if (!weapon) return;
      weaponCounts[weapon] = (weaponCounts[weapon] || 0) + 1;
    });

    // Count by type
    const typeCounts: Record<string, number> = {};
    todayPosts.forEach(p => {
      typeCounts[p.itemType] = (typeCounts[p.itemType] || 0) + 1;
    });

    // Get most popular item type today
    const mostPopularType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const topCategoryText = mostPopularType ? `${formatPostTypeLabel(mostPopularType[0])} (${mostPopularType[1]}x)` : 'N/A';

    const topSkinId = topEntryKey(skinIdCounts);
    const topSkinName = topSkinId ? (skinNameById[topSkinId] || '') : '';
    const topSkinText = topSkinId ? topEntryText({ [topSkinName]: skinIdCounts[topSkinId] }, 38) : 'N/A';
    const topSkinUrl = topSkinId ? itemUrlFromId(topSkinId) : '';
    const topWeaponText = Object.keys(weaponCounts).length ? topEntryText(weaponCounts, 28) : 'N/A';
    
    // Get top 3 movers from today
    const { gainers, losers } = await getTopMovers('24h', 3);
    
    const dailyText = `📊 Daily CS2 Market Summary\n\n` +
      `📈 Posts today: ${todayPosts.length}\n` +
      `🎮 Top skin: ${topSkinText}\n` +
      (topSkinUrl ? `🔗 ${topSkinUrl}\n` : '') +
      `🔫 Top weapon: ${topWeaponText}\n` +
      (topSkinText === 'N/A' ? `🗂️ Top category: ${topCategoryText}\n` : '') +
      `\n` +
      (gainers.length > 0 ? `📈 Top Gainers:\n${gainers.slice(0, 3).map((g, i) => `${i + 1}. ${g.marketHashName} +${g.changePercent.toFixed(1)}%`).join('\n')}\n\n` : '') +
      (losers.length > 0 ? `📉 Top Losers:\n${losers.slice(0, 3).map((l, i) => `${i + 1}. ${l.marketHashName} ${l.changePercent.toFixed(1)}%`).join('\n')}\n\n` : '') +
      `Track your CS2 inventory:\nhttps://skinvaults.online\n\n` +
      `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins\n@counterstrike`;

    // Post the daily summary (same OAuth logic)
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET || process.env.X_APISECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
      return { success: false, error: 'X API credentials not configured' };
    }

    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('base64');

    const params: Record<string, string> = {
      oauth_consumer_key: X_API_KEY,
      oauth_token: X_ACCESS_TOKEN,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    };

    const paramString = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_TOKEN_SECRET)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');

    params.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`)
      .join(', ');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: dailyText.substring(0, 280), // X character limit
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('X API error:', errorText);
      return { success: false, error: `X API error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, postId: data.data?.id };
  } catch (error: any) {
    console.error('Failed to create daily summary:', error);
    return { success: false, error: error.message || 'Failed to create daily summary' };
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
      // Post about all unposted users in one post (max 5 to keep message readable)
      const usersToPost = unpostedNewUsers.slice(0, 5);
      console.log('[X Post Types] Returning new user milestone for', usersToPost.length, 'user(s):', usersToPost.map(u => u.steamName).join(', '));
      return {
        hasMilestone: true,
        shouldPost: true,
        milestone: {
          type: 'new_user',
          users: usersToPost, // Changed from single user to array
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
 * Create new user welcome post (supports single user or multiple users)
 */
export async function createNewUserPost(users: NewUser | NewUser[]): Promise<{ success: boolean; postId?: string; error?: string; itemName?: string }> {
  try {
    const result = await createNewUserWelcomePost(users);
    const usersArray = Array.isArray(users) ? users : [users];
    const userNames = usersArray.map(u => u.steamName).join(', ');
    return {
      ...result,
      itemName: usersArray.length === 1 ? userNames : `${usersArray.length} new users`,
    };
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
      `Track your CS2 inventory:\nhttps://www.skinvaults.online\n\n` +
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
        `Track your CS2 inventory:\nhttps://www.skinvaults.online\n\n` +
        `#CS2Skins #CounterStrike2 #Skinvaults #CS2 #CSGO #Skins @counterstrike`;
    } else {
      milestoneText = `🎉 Milestone Reached!\n\n` +
        `Thank you for being part of the SkinVaults community! 🚀\n\n` +
        `Track your CS2 inventory:\nhttps://www.skinvaults.online\n\n` +
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
      `Track your CS2 inventory:\nhttps://www.skinvaults.online\n\n` +
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

