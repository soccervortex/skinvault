import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { dbGet, dbSet } from '@/app/utils/database';

const X_POSTING_ENABLED_KEY = 'x_posting_enabled';
const X_POSTING_LAST_POST_KEY = 'x_posting_last_post';

// GET: Get X posting status
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');
    
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const enabled = (await dbGet<boolean>(X_POSTING_ENABLED_KEY)) || false;
    const lastPost = await dbGet<string>(X_POSTING_LAST_POST_KEY);

    return NextResponse.json({
      enabled,
      lastPost,
    });
  } catch (error) {
    console.error('Failed to get X posting status:', error);
    return NextResponse.json({ error: 'Failed to get X posting status' }, { status: 500 });
  }
}

// POST: Update X posting status
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');
    
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled === 'boolean') {
      await dbSet(X_POSTING_ENABLED_KEY, enabled);
      
      // If enabling, trigger initial test post
      if (enabled) {
        // Trigger test post via internal API
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000');
        
        // Await the response to catch errors, but don't fail the main request
        try {
          const testPostResponse = await fetch(`${baseUrl}/api/x/post/test`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ adminSteamId }),
          });
          
          const testPostData = await testPostResponse.json();
          if (!testPostResponse.ok) {
            console.error('[X Posting] Test post failed:', testPostData.error);
          } else {
            console.log('[X Posting] Test post successful:', testPostData);
          }
        } catch (error) {
          console.error('[X Posting] Failed to trigger test post:', error);
          // Don't fail the main request if test post fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      enabled: typeof enabled === 'boolean' ? enabled : (await dbGet<boolean>(X_POSTING_ENABLED_KEY)) || false,
    });
  } catch (error) {
    console.error('Failed to update X posting status:', error);
    return NextResponse.json({ error: 'Failed to update X posting status' }, { status: 500 });
  }
}

