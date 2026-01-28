import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import {
  createWeeklySummaryPost,
  createMonthlyStatsPost,
  createGiveawaysDigestPost,
  createItemHighlightPost,
  createTestPost,
  createDailySummaryPost,
  createNewUserPost,
  createUserMilestonePost,
  createTrendingAlertPost,
  createFeatureAnnouncementPost,
  checkForMilestonesOrAlerts,
} from '@/app/lib/x-post-types';
import type { NextRequest } from 'next/server';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'x_post')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { postType } = body; // 'weekly', 'monthly', 'giveaways', 'test', 'daily', 'milestone', or 'new_user'

    if (!postType || !['weekly', 'monthly', 'giveaways', 'test', 'daily', 'milestone', 'new_user'].includes(postType)) {
      return NextResponse.json(
        { error: 'Invalid postType. Must be: weekly, monthly, giveaways, test, daily, milestone, or new_user' },
        { status: 400 }
      );
    }

    let result;
    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];

    switch (postType) {
      case 'weekly':
        result = await createWeeklySummaryPost();
        break;
      
      case 'monthly':
        result = await createMonthlyStatsPost();
        break;

      case 'giveaways':
        result = await createGiveawaysDigestPost();
        break;
      
      case 'test':
        result = await createTestPost(postHistory);
        break;
      
      case 'daily':
        result = await createDailySummaryPost();
        break;
      
      case 'milestone':
        const milestoneCheck = await checkForMilestonesOrAlerts();
        if (milestoneCheck.hasMilestone && milestoneCheck.shouldPost) {
          if (milestoneCheck.milestone?.type === 'user_milestone') {
            result = await createUserMilestonePost(milestoneCheck.milestone.milestone);
          } else if (milestoneCheck.milestone?.type === 'trending_alert') {
            result = await createTrendingAlertPost(milestoneCheck.milestone.item);
          } else if (milestoneCheck.milestone?.type === 'feature_announcement') {
            result = await createFeatureAnnouncementPost(milestoneCheck.milestone.announcement);
          } else {
            result = await createItemHighlightPost(postHistory);
          }
        } else {
          result = { success: false, error: 'No milestone or alert found to post' };
        }
        break;
      
      case 'new_user':
        const newUserCheck = await checkForMilestonesOrAlerts();
        if (newUserCheck.hasMilestone && newUserCheck.shouldPost && newUserCheck.milestone?.type === 'new_user') {
          result = await createNewUserPost(newUserCheck.milestone.users || newUserCheck.milestone.user);
        } else {
          result = { success: false, error: 'No new users found to post' };
        }
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid postType' },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        postId: result.postId,
        itemName: 'itemName' in result ? result.itemName || null : null,
        message: `Successfully posted ${postType} post`,
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to create post' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error creating manual post:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    );
  }
}

// GET: Get date ranges and post statistics
export async function GET(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'x_post')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    // Calculate date ranges
    // Weekly: last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Monthly: from start of current month
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    
    // Next month start (max date for monthly count)
    const nextMonthStart = new Date(currentYear, currentMonth, 1);
    
    // Format dates as DD-MM-YYYY
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Get post history
    const postHistoryRaw = await dbGet<
      Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>
    >('x_posting_history');
    const postHistory = Array.isArray(postHistoryRaw) ? postHistoryRaw : [];

    // Count posts in different periods
    const weeklyPosts = postHistory.filter(p => {
      const postDate = new Date((p as any)?.date);
      return postDate >= sevenDaysAgo;
    });

    const monthlyPosts = postHistory.filter(p => {
      const postDate = new Date((p as any)?.date);
      return postDate >= monthStart;
    });

    // Count by type for weekly
    const weeklyTypeCounts: Record<string, number> = {};
    weeklyPosts.forEach(p => {
      weeklyTypeCounts[p.itemType] = (weeklyTypeCounts[p.itemType] || 0) + 1;
    });

    // Count by type for monthly
    const monthlyTypeCounts: Record<string, number> = {};
    monthlyPosts.forEach(p => {
      monthlyTypeCounts[p.itemType] = (monthlyTypeCounts[p.itemType] || 0) + 1;
    });

    return NextResponse.json({
      weekly: {
        startDate: formatDate(sevenDaysAgo),
        endDate: formatDate(now),
        postCount: weeklyPosts.length,
        typeCounts: weeklyTypeCounts,
      },
      monthly: {
        startDate: formatDate(monthStart),
        endDate: formatDate(now),
        maxDate: formatDate(nextMonthStart),
        postCount: monthlyPosts.length,
        typeCounts: monthlyTypeCounts,
      },
      currentDate: formatDate(now),
    });
  } catch (error: any) {
    console.error('Error getting post statistics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get statistics' },
      { status: 500 }
    );
  }
}

