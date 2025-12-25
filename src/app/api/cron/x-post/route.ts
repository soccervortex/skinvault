import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import {
  checkIfPostedTodayOnX,
} from '@/app/lib/inngest-functions';
import {
  determinePostType,
  createWeeklySummaryPost,
  createMonthlyStatsPost,
  createItemHighlightPost,
  checkForMilestonesOrAlerts,
  createTrendingAlertPost,
  createUserMilestonePost,
  createFeatureAnnouncementPost,
  PostType,
} from '@/app/lib/x-post-types';
import { updatePriceHistory } from '@/app/lib/price-tracking';

/**
 * Vercel Cron Job: Automated X Posting
 * Runs at 11:00 AM Amsterdam time (10:00 UTC) and 11:30 AM (10:30 UTC) for retry
 * 
 * This is the PRIMARY automated posting system (more reliable than Inngest)
 * 
 * Cron schedule in vercel.json:
 * - "0 10 * * *" = 11:00 AM Amsterdam (CET) / 12:00 PM (CEST)
 * - "30 10 * * *" = 11:30 AM Amsterdam (CET) / 12:30 PM (CEST) - retry if first failed
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request (Vercel sends a special header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[X Cron] Starting automated posting check...');

    // Check if X posting is enabled
    const enabled = (await dbGet<boolean>('x_posting_enabled')) || false;
    if (!enabled) {
      console.log('[X Cron] X posting is disabled, skipping');
      return NextResponse.json({ skipped: true, reason: 'disabled' });
    }

    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string; reads?: number }>>('x_posting_history')) || [];
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Check if we already posted today (check database first)
    const todayPosts = postHistory.filter(p => {
      const postDate = new Date(p.date);
      const postDay = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, '0')}-${String(postDate.getDate()).padStart(2, '0')}`;
      return postDay === today;
    });

    if (todayPosts.length > 0) {
      console.log(`[X Cron] Already posted ${todayPosts.length} time(s) today, skipping`);
      return NextResponse.json({ 
        skipped: true, 
        reason: 'already_posted_today', 
        count: todayPosts.length 
      });
    }

    // Also check X API to see if we posted today (double check)
    try {
      const alreadyPostedOnX = await checkIfPostedTodayOnX();
      if (alreadyPostedOnX) {
        console.log('[X Cron] Found post on X profile today, skipping');
        return NextResponse.json({ skipped: true, reason: 'already_posted_on_x_today' });
      }
    } catch (error) {
      console.warn('[X Cron] Could not check X profile, continuing anyway:', error);
    }

    // Check monthly post count (500 limit)
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthPosts = postHistory.filter(p => p.date.startsWith(currentMonth));
    
    // Smart limit: If we have low engagement (reads), reduce posting frequency
    // Calculate average engagement rate from recent posts
    const recentPosts = thisMonthPosts.slice(-30); // Last 30 posts
    const totalReads = recentPosts.reduce((sum, p) => sum + (p.reads || 0), 0);
    const avgReadsPerPost = recentPosts.length > 0 ? totalReads / recentPosts.length : 0;
    
    // Check if we've been blocked recently (within last 24 hours)
    // Reset block at start of each month
    const lastBlockTime = await dbGet<string>('x_posting_last_block');
    const lastBlockMonth = lastBlockTime ? new Date(lastBlockTime).getUTCMonth() : null;
    const currentMonth = now.getUTCMonth();
    
    // Reset block if we're in a new month
    if (lastBlockMonth !== null && lastBlockMonth !== currentMonth) {
      await dbSet('x_posting_last_block', null);
      console.log('[X Cron] New month detected, resetting engagement block');
    }
    
    const hoursSinceLastBlock = lastBlockTime && lastBlockMonth === currentMonth
      ? (now.getTime() - new Date(lastBlockTime).getTime()) / (1000 * 60 * 60)
      : Infinity;
    
    // If average reads per post is very low (< 10), reduce monthly limit
    // This prevents spamming when engagement is low
    const effectiveLimit = avgReadsPerPost < 10 && thisMonthPosts.length > 50 
      ? Math.min(500, Math.max(50, Math.floor(thisMonthPosts.length * 1.1))) // Only 10% growth if low engagement
      : 500; // Full limit if engagement is good
    
    if (thisMonthPosts.length >= effectiveLimit) {
      console.log(`[X Cron] Monthly limit reached (${effectiveLimit} posts, avg reads: ${avgReadsPerPost.toFixed(1)}), skipping`);
      return NextResponse.json({ 
        skipped: true, 
        reason: 'monthly_limit_reached', 
        count: thisMonthPosts.length,
        effectiveLimit,
        avgReadsPerPost: avgReadsPerPost.toFixed(1)
      });
    }
    
    // Additional check: If we're posting too much relative to engagement
    // Skip posting if we have very low engagement rate (< 5 reads per post on average)
    // Strategy: Reduce frequency instead of complete block - ensure at least 2-3 posts per week
    // NOTE: This check is skipped for weekly_summary and monthly_stats posts (they always post)
    // This check will be done later, after postType is determined
      const daysSinceLastBlock = hoursSinceLastBlock / 24;
      const lastPostTime = await dbGet<string>('x_posting_last_post');
      const hoursSinceLastPost = lastPostTime 
        ? (now.getTime() - new Date(lastPostTime).getTime()) / (1000 * 60 * 60)
        : Infinity;
      const daysSinceLastPost = hoursSinceLastPost / 24;
      
      // Smart frequency reduction:
      // - First 2 days: Complete block (skip all posts)
      // - After 2 days: Allow 1 post per 3 days (min 2-3 posts per week)
      // - After 7 days: Allow 1 post per 2 days (slightly more frequent)
      // - After 14 days: Resume normal posting (engagement might have improved)
      
      if (daysSinceLastBlock < 2) {
        // First 2 days: Complete block
        if (hoursSinceLastBlock < 24) {
          console.log(`[X Cron] Low engagement (${avgReadsPerPost.toFixed(1)} reads/post), blocked (${hoursSinceLastBlock.toFixed(1)}h ago), skipping`);
          return NextResponse.json({ 
            skipped: true, 
            reason: 'low_engagement_blocked', 
            avgReadsPerPost: avgReadsPerPost.toFixed(1),
            hoursSinceBlock: hoursSinceLastBlock.toFixed(1),
            message: `Posting paused due to low engagement. Will retry in ${(24 - hoursSinceLastBlock).toFixed(1)} hours.`
          });
        } else {
          // 24h passed, but still in 2-day block period - check if we can post (reduced frequency)
          if (daysSinceLastPost < 3) {
            console.log(`[X Cron] Low engagement - reduced frequency: last post ${daysSinceLastPost.toFixed(1)} days ago, need 3 days`);
            return NextResponse.json({ 
              skipped: true, 
              reason: 'low_engagement_reduced_frequency', 
              avgReadsPerPost: avgReadsPerPost.toFixed(1),
              daysSinceLastPost: daysSinceLastPost.toFixed(1),
              message: `Posting reduced to 1 post per 3 days. Next post in ${(3 - daysSinceLastPost).toFixed(1)} days.`
            });
          }
          // Allow post (3 days passed)
          console.log(`[X Cron] Low engagement - allowing post (3 days since last post)`);
        }
      } else if (daysSinceLastBlock < 7) {
        // After 2 days: 1 post per 3 days (ensures 2-3 posts per week)
        if (daysSinceLastPost < 3) {
          console.log(`[X Cron] Low engagement - reduced frequency: last post ${daysSinceLastPost.toFixed(1)} days ago, need 3 days`);
          return NextResponse.json({ 
            skipped: true, 
            reason: 'low_engagement_reduced_frequency', 
            avgReadsPerPost: avgReadsPerPost.toFixed(1),
            daysSinceLastPost: daysSinceLastPost.toFixed(1),
            message: `Posting reduced to 1 post per 3 days. Next post in ${(3 - daysSinceLastPost).toFixed(1)} days.`
          });
        }
        console.log(`[X Cron] Low engagement - allowing post (3 days since last post)`);
      } else if (daysSinceLastBlock < 14) {
        // After 7 days: 1 post per 2 days (slightly more frequent)
        if (daysSinceLastPost < 2) {
          console.log(`[X Cron] Low engagement - reduced frequency: last post ${daysSinceLastPost.toFixed(1)} days ago, need 2 days`);
          return NextResponse.json({ 
            skipped: true, 
            reason: 'low_engagement_reduced_frequency', 
            avgReadsPerPost: avgReadsPerPost.toFixed(1),
            daysSinceLastPost: daysSinceLastPost.toFixed(1),
            message: `Posting reduced to 1 post per 2 days. Next post in ${(2 - daysSinceLastPost).toFixed(1)} days.`
          });
        }
        console.log(`[X Cron] Low engagement - allowing post (2 days since last post)`);
      } else {
        // After 14 days: Keep reduced frequency (1 post per 2 days) if engagement still low
        // Don't clear block - keep reduced frequency to prevent spam
        if (daysSinceLastPost < 2) {
          console.log(`[X Cron] Low engagement persists after 14 days - keeping reduced frequency: last post ${daysSinceLastPost.toFixed(1)} days ago, need 2 days`);
          return NextResponse.json({ 
            skipped: true, 
            reason: 'low_engagement_reduced_frequency', 
            avgReadsPerPost: avgReadsPerPost.toFixed(1),
            daysSinceLastPost: daysSinceLastPost.toFixed(1),
            message: `Posting reduced to 1 post per 2 days due to persistent low engagement. Next post in ${(2 - daysSinceLastPost).toFixed(1)} days.`
          });
        }
        console.log(`[X Cron] Low engagement persists after 14 days - allowing post (2 days since last post, reduced frequency maintained)`);
        // Continue with posting (reduced frequency maintained)
      }
      
      // Set block timestamp if not already set
      if (!lastBlockTime) {
        await dbSet('x_posting_last_block', now.toISOString());
      }
    }

    // Determine what type of post to make based on day/time
    const context = {
      dayOfWeek: now.getUTCDay(), // 0 = Sunday, 1 = Monday, etc.
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      dayOfMonth: now.getUTCDate(),
      isFirstOfMonth: now.getUTCDate() === 1,
    };

    const postType = determinePostType(context);
    console.log(`[X Cron] Post type determined: ${postType} (Day: ${context.dayOfWeek}, Hour: ${context.hour}, Minute: ${context.minute}, First of month: ${context.isFirstOfMonth})`);

    let postResult: { success: boolean; postId?: string; error?: string; itemName?: string };

    // Create post based on type
    switch (postType) {
      case 'weekly_summary':
        console.log('[X Cron] Creating weekly summary post...');
        postResult = await createWeeklySummaryPost();
        break;

      case 'monthly_stats':
        console.log('[X Cron] Creating monthly stats post...');
        postResult = await createMonthlyStatsPost();
        break;

      case 'milestone':
      case 'alert':
        // Check for milestones/alerts first
        const milestoneCheck = await checkForMilestonesOrAlerts();
        if (milestoneCheck.hasMilestone && milestoneCheck.shouldPost) {
          if (milestoneCheck.milestone?.type === 'feature_announcement') {
            console.log('[X Cron] Creating feature announcement post...');
            postResult = await createFeatureAnnouncementPost(milestoneCheck.milestone.announcement);
          } else if (milestoneCheck.milestone?.type === 'user_milestone') {
            console.log('[X Cron] Creating user milestone post...');
            postResult = await createUserMilestonePost(milestoneCheck.milestone.milestone);
          } else if (milestoneCheck.milestone?.type === 'trending_alert') {
            console.log('[X Cron] Creating trending alert post...');
            postResult = await createTrendingAlertPost(milestoneCheck.milestone.item);
          } else {
            // Unknown milestone type, use regular item highlight
            postResult = await createItemHighlightPost(postHistory);
          }
        } else {
          // No milestone/alert, use regular item highlight
          postResult = await createItemHighlightPost(postHistory);
        }
        break;

      case 'item_highlight':
      default:
        console.log('[X Cron] Creating item highlight post...');
        postResult = await createItemHighlightPost(postHistory);
        break;
    }

    if (postResult.success && postResult.postId) {
      // Clear any previous block (posting succeeded, engagement might be improving)
      await dbSet('x_posting_last_block', null);
      
      // Update history with initial reads count (0, will be updated later via engagement tracking)
      const newHistory = [
        ...postHistory,
        {
          date: now.toISOString(),
          postId: postResult.postId,
          itemId: postResult.itemName || '',
          itemName: postResult.itemName || postType,
          itemType: postType,
          reads: 0, // Initial reads count, will be updated by engagement tracking
        },
      ];
      await dbSet('x_posting_history', newHistory);
      await dbSet('x_posting_last_post', now.toISOString());

      console.log(`[X Cron] Successfully posted ${postType} post`);
      console.log(`[X Cron] Post ID: ${postResult.postId}`);
      console.log(`[X Cron] Post URL: https://x.com/Skinvaults/status/${postResult.postId}`);

      return NextResponse.json({
        success: true,
        postType,
        postId: postResult.postId,
        itemName: postResult.itemName || postType,
        postUrl: `https://x.com/Skinvaults/status/${postResult.postId}`,
        monthlyCount: thisMonthPosts.length + 1,
      });
    } else {
      console.error('[X Cron] Failed to create post:', postResult.error);
      
      // Store failure for retry logic
      const lastFailure = await dbGet<string>('x_posting_last_failure');
      const currentTime = now.toISOString();
      
      // If this is the first attempt (11:00 AM) and it failed, mark for retry
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      
      if (currentHour === 10 && currentMinute === 0) {
        // First attempt at 11:00 AM (10:00 UTC)
        await dbSet('x_posting_last_failure', currentTime);
        await dbSet('x_posting_retry_needed', 'true');
        console.log('[X Cron] First attempt failed, will retry at 11:30 AM');
      }

      return NextResponse.json({
        success: false,
        postType,
        error: postResult.error || 'Failed to create post',
        itemName: postResult.itemName || postType,
        willRetry: currentHour === 10 && currentMinute === 0,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[X Cron] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process automated posting' },
      { status: 500 }
    );
  }
}

