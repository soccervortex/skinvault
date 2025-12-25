import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { createAutomatedXPostWithImage, getNextItemFromAllDatasets, getItemPrice } from '@/app/lib/inngest-functions';
import { dbGet, dbSet } from '@/app/utils/database';

/**
 * Manually trigger automated X posting
 * This allows owners to test and manually trigger the automated posting function
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminSteamId } = body;

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if X posting is enabled
    const enabled = (await dbGet<boolean>('x_posting_enabled')) || false;
    if (!enabled) {
      return NextResponse.json({ 
        error: 'X posting is not enabled. Please enable it in the admin panel first.',
        enabled: false 
      }, { status: 400 });
    }

    // Get post history
    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];
    
    // Get next item from all datasets
    const item = await getNextItemFromAllDatasets(postHistory);

    if (!item) {
      return NextResponse.json({ error: 'No item found for posting' }, { status: 500 });
    }

    // Get real price from Steam API
    const priceData = await getItemPrice(item.marketHashName || item.name);

    // Create item page URL
    const itemPageUrl = `https://www.skinvaults.online/item/${encodeURIComponent(item.id || item.marketHashName || item.name)}`;

    // Create and post with image
    const postResult = await createAutomatedXPostWithImage({
      ...item,
      price: priceData?.price || 'Check price',
      itemPageUrl,
    });

    if (postResult.success && postResult.postId) {
      // Update history
      const now = new Date();
      const newHistory = [
        ...postHistory,
        {
          date: now.toISOString(),
          postId: postResult.postId,
          itemId: item.id || '',
          itemName: item.name,
          itemType: item.type || 'skin',
        },
      ];
      await dbSet('x_posting_history', newHistory);
      await dbSet('x_posting_last_post', now.toISOString());

      return NextResponse.json({
        success: true,
        message: 'Post created successfully',
        postId: postResult.postId,
        itemName: item.name,
        itemType: item.type || 'skin',
        postUrl: `https://x.com/Skinvaults/status/${postResult.postId}`,
      });
    } else {
      console.error('[X Manual Trigger] Failed to create post:', postResult.error);
      return NextResponse.json(
        { 
          success: false,
          error: postResult.error || 'Failed to create post',
          itemName: item.name,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Failed to trigger manual post:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger manual post' },
      { status: 500 }
    );
  }
}

/**
 * GET: Check status of automated posting
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const enabled = (await dbGet<boolean>('x_posting_enabled')) || false;
    const lastPost = await dbGet<string>('x_posting_last_post');
    const postHistory = (await dbGet<Array<{ date: string; postId: string; itemId: string; itemName: string; itemType: string }>>('x_posting_history')) || [];

    // Check if posted today
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayPosts = postHistory.filter(p => {
      const postDate = new Date(p.date);
      const postDay = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, '0')}-${String(postDate.getDate()).padStart(2, '0')}`;
      return postDay === today;
    });

    // Check monthly count
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthPosts = postHistory.filter(p => p.date.startsWith(currentMonth));

    return NextResponse.json({
      enabled,
      lastPost,
      todayPosts: todayPosts.length,
      monthlyPosts: thisMonthPosts.length,
      monthlyLimit: 500,
      nextScheduledTime: '11:15 AM Amsterdam time (10:15 UTC)',
      status: enabled 
        ? (todayPosts.length > 0 ? 'Posted today' : 'Will post at 11:15 AM if not posted today')
        : 'Disabled',
    });
  } catch (error: any) {
    console.error('Failed to get posting status:', error);
    return NextResponse.json({ error: 'Failed to get posting status' }, { status: 500 });
  }
}

