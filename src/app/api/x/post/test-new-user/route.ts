import { NextResponse } from 'next/server';
import { getUnpostedNewUsers, createNewUserWelcomePost } from '@/app/lib/new-user-posts';

/**
 * Test endpoint to manually check for new users and create welcome posts
 * GET /api/x/post/test-new-user
 */
export async function GET(request: Request) {
  try {
    console.log('[Test New User] Starting test...');
    
    // Get unposted new users
    const unpostedUsers = await getUnpostedNewUsers();
    console.log('[Test New User] Found unposted users:', unpostedUsers.length);
    
    if (unpostedUsers.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No unposted new users found',
        unpostedCount: 0,
      });
    }

    // Try to post about the first unposted user
    const firstUser = unpostedUsers[0];
    console.log('[Test New User] Attempting to post for user:', firstUser.steamId, firstUser.steamName);
    
    const result = await createNewUserWelcomePost(firstUser);
    
    return NextResponse.json({
      success: result.success,
      postId: result.postId,
      error: result.error,
      user: {
        steamId: firstUser.steamId,
        steamName: firstUser.steamName,
        firstLoginDate: firstUser.firstLoginDate,
      },
      unpostedCount: unpostedUsers.length,
      allUnpostedUsers: unpostedUsers.map(u => ({
        steamId: u.steamId,
        steamName: u.steamName,
        firstLoginDate: u.firstLoginDate,
      })),
    });
  } catch (error: any) {
    console.error('[Test New User] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to test new user post',
    }, { status: 500 });
  }
}

