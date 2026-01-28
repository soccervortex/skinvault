import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

const X_POSTING_ENABLED_KEY = 'x_posting_enabled';
const X_POSTING_LAST_POST_KEY = 'x_posting_last_post';

// GET: Get X posting status
export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled === 'boolean') {
      await dbSet(X_POSTING_ENABLED_KEY, enabled);
      
      // If enabling, trigger initial test post
      let testPostError: string | null = null;
      let testPostSuccess = false;
      
      if (enabled) {
        // Trigger test post via internal API
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000');
        
        // Await the response to catch errors
        try {
          console.log('[X Posting] Triggering test post to:', `${baseUrl}/api/x/post/test`);
          const cookie = request.headers.get('cookie') || '';
          const testPostResponse = await fetch(`${baseUrl}/api/x/post/test`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(cookie ? { cookie } : {}),
            },
          });
          
          const testPostData = await testPostResponse.json();
          if (!testPostResponse.ok) {
            testPostError = testPostData.error || 'Test post failed';
            console.error('[X Posting] Test post failed:', testPostError);
          } else {
            testPostSuccess = true;
            console.log('[X Posting] Test post successful:', testPostData);
            // Update last post timestamp
            await dbSet(X_POSTING_LAST_POST_KEY, new Date().toISOString());
          }
        } catch (error: any) {
          testPostError = error.message || 'Failed to trigger test post';
          console.error('[X Posting] Failed to trigger test post:', error);
        }
      }

      return NextResponse.json({
        success: true,
        enabled: enabled,
        testPostSuccess,
        testPostError,
        message: enabled 
          ? (testPostSuccess 
              ? 'X posting enabled and test post created successfully!' 
              : testPostError 
                ? `X posting enabled but test post failed: ${testPostError}`
                : 'X posting enabled')
          : 'X posting disabled',
      });
    }

    return NextResponse.json({
      success: true,
      enabled: (await dbGet<boolean>(X_POSTING_ENABLED_KEY)) || false,
    });
  } catch (error) {
    console.error('Failed to update X posting status:', error);
    return NextResponse.json({ error: 'Failed to update X posting status' }, { status: 500 });
  }
}

