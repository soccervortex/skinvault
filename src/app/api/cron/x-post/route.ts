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
  PostType,
} from '@/app/lib/x-post-types';

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

    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];
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
    
    if (thisMonthPosts.length >= 500) {
      console.log('[X Cron] Monthly limit reached (500 posts), skipping');
      return NextResponse.json({ 
        skipped: true, 
        reason: 'monthly_limit_reached', 
        count: thisMonthPosts.length 
      });
    }

    // Determine what type of post to make based on day/time
    const now = new Date();
    const context = {
      dayOfWeek: now.getUTCDay(), // 0 = Sunday, 1 = Monday, etc.
      hour: now.getUTCHours(),
      dayOfMonth: now.getUTCDate(),
      isFirstOfMonth: now.getUTCDate() === 1,
    };

    const postType = determinePostType(context);
    console.log(`[X Cron] Post type determined: ${postType} (Day: ${context.dayOfWeek}, Hour: ${context.hour}, First of month: ${context.isFirstOfMonth})`);

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
        if (milestoneCheck.hasMilestone) {
          // TODO: Create milestone post
          console.log('[X Cron] Milestone found, but not implemented yet. Falling back to item highlight.');
          postResult = await createItemHighlightPost(postHistory);
        } else {
          // No milestone, use regular item highlight
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
      // Update history
      const newHistory = [
        ...postHistory,
        {
          date: now.toISOString(),
          postId: postResult.postId,
          itemId: postResult.itemName || '',
          itemName: postResult.itemName || postType,
          itemType: postType,
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

