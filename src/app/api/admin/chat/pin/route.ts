import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { getAdminSteamId, isOwnerRequest } from '@/app/utils/admin-auth';

const PINNED_MESSAGES_KEY = 'pinned_messages'; // Format: { "messageId": { messageType: 'global'|'dm', pinnedAt: Date, pinnedBy: steamId } }

// POST: Pin a message
export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const adminSteamId = getAdminSteamId(request);

    const body = await request.json();
    const { messageId, messageType = 'global' } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const pinnedMessages = await dbGet<Record<string, any>>(PINNED_MESSAGES_KEY, false) || {};
    
    pinnedMessages[messageId] = {
      messageType,
      pinnedAt: new Date().toISOString(),
      pinnedBy: adminSteamId,
    };

    await dbSet(PINNED_MESSAGES_KEY, pinnedMessages);

    return NextResponse.json({ success: true, message: 'Message pinned' });
  } catch (error) {
    console.error('Failed to pin message:', error);
    return NextResponse.json({ error: 'Failed to pin message' }, { status: 500 });
  }
}

// DELETE: Unpin a message
export async function DELETE(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const { searchParams: bodyParams } = new URL(request.url);
    const messageId = bodyParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const pinnedMessages = await dbGet<Record<string, any>>(PINNED_MESSAGES_KEY, false) || {};
    delete pinnedMessages[messageId];
    await dbSet(PINNED_MESSAGES_KEY, pinnedMessages);

    return NextResponse.json({ success: true, message: 'Message unpinned' });
  } catch (error) {
    console.error('Failed to unpin message:', error);
    return NextResponse.json({ error: 'Failed to unpin message' }, { status: 500 });
  }
}

// GET: Get pinned messages
export async function GET(request: Request) {
  try {
    const pinnedMessages = await dbGet<Record<string, any>>(PINNED_MESSAGES_KEY, false) || {};
    return NextResponse.json({ pinnedMessages: Object.entries(pinnedMessages).map(([id, data]) => ({ id, ...data })) });
  } catch (error) {
    console.error('Failed to get pinned messages:', error);
    return NextResponse.json({ error: 'Failed to get pinned messages' }, { status: 500 });
  }
}

