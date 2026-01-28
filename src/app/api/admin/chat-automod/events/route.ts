import { NextResponse } from 'next/server';
import { clearChatAutomodEvents, getChatAutomodEvents } from '@/app/utils/chat-automod-log';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '200', 10) || 200));

    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const events = await getChatAutomodEvents(limit);
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Failed to get automod events:', error);
    return NextResponse.json({ error: 'Failed to get automod events' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await clearChatAutomodEvents();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear automod events:', error);
    return NextResponse.json({ error: 'Failed to clear automod events' }, { status: 500 });
  }
}
