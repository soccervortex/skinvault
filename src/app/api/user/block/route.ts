import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

const USER_BLOCKS_KEY = 'user_blocks'; // Format: { "steamId1_steamId2": true }

/**
 * POST: Block a user (user-to-user ban)
 * Prevents users from finding each other, sending invites, or messaging
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { blockerSteamId, blockedSteamId } = body;

    if (!blockerSteamId || !blockedSteamId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (blockerSteamId === blockedSteamId) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    // Get existing blocks
    const blocks = await dbGet<Record<string, boolean>>(USER_BLOCKS_KEY, false) || {};
    
    // Create block key (sorted to ensure consistency)
    const blockKey = [blockerSteamId, blockedSteamId].sort().join('_');
    
    // Add block
    blocks[blockKey] = true;
    await dbSet(USER_BLOCKS_KEY, blocks);

    return NextResponse.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    console.error('Failed to block user:', error);
    return NextResponse.json({ error: 'Failed to block user' }, { status: 500 });
  }
}

/**
 * DELETE: Unblock a user
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const blockerSteamId = searchParams.get('blockerSteamId');
    const blockedSteamId = searchParams.get('blockedSteamId');

    if (!blockerSteamId || !blockedSteamId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get existing blocks
    const blocks = await dbGet<Record<string, boolean>>(USER_BLOCKS_KEY, false) || {};
    
    // Create block key (sorted to ensure consistency)
    const blockKey = [blockerSteamId, blockedSteamId].sort().join('_');
    
    // Remove block
    delete blocks[blockKey];
    await dbSet(USER_BLOCKS_KEY, blocks);

    return NextResponse.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Failed to unblock user:', error);
    return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 });
  }
}

/**
 * GET: Check if users are blocked
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId1 = searchParams.get('steamId1');
    const steamId2 = searchParams.get('steamId2');

    if (!steamId1 || !steamId2) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get existing blocks
    const blocks = await dbGet<Record<string, boolean>>(USER_BLOCKS_KEY, false) || {};
    
    // Create block key (sorted to ensure consistency)
    const blockKey = [steamId1, steamId2].sort().join('_');
    
    const isBlocked = blocks[blockKey] === true;

    return NextResponse.json({ isBlocked });
  } catch (error) {
    console.error('Failed to check block status:', error);
    return NextResponse.json({ isBlocked: false });
  }
}

