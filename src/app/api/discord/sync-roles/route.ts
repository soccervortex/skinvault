import { NextResponse } from 'next/server';

/**
 * API endpoint to trigger Discord role sync
 * This can be called when:
 * - User connects Discord account
 * - User gets Pro subscription
 * - User's Pro expires
 * - Admin wants to manually sync roles
 * 
 * The Discord bot will check this endpoint periodically and sync roles
 */
export async function POST(request: Request) {
  try {
    const { discordId, steamId, reason } = await request.json().catch(() => ({}));

    if (!discordId && !steamId) {
      return NextResponse.json({ error: 'Missing discordId or steamId' }, { status: 400 });
    }

    // This endpoint just logs the request
    // The Discord bot will check for pending role syncs via its own mechanism
    console.log(`[Discord Role Sync] Request to sync roles:`, {
      discordId,
      steamId,
      reason: reason || 'manual',
      timestamp: new Date().toISOString(),
    });

    // Store sync request in database (optional - for bot to check)
    try {
      const { dbGet, dbSet } = await import('@/app/utils/database');
      const syncQueueKey = 'discord_role_sync_queue';
      const queue = (await dbGet<Array<{ discordId?: string; steamId?: string; reason: string; timestamp: string }>>(syncQueueKey)) || [];
      
      queue.push({
        discordId,
        steamId,
        reason: reason || 'manual',
        timestamp: new Date().toISOString(),
      });

      // Keep only last 100 sync requests
      if (queue.length > 100) {
        queue.splice(0, queue.length - 100);
      }

      await dbSet(syncQueueKey, queue);
    } catch (error) {
      console.error('[Discord Role Sync] Error storing sync request:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Role sync request queued',
      discordId,
      steamId,
    });
  } catch (error: any) {
    console.error('[Discord Role Sync] Error:', error);
    return NextResponse.json({ error: 'Failed to queue role sync' }, { status: 500 });
  }
}

