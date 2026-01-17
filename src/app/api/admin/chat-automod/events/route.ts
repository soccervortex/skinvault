import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import { clearChatAutomodEvents, getChatAutomodEvents } from '@/app/utils/chat-automod-log';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');
    const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '200', 10) || 200));

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const events = await getChatAutomodEvents(limit);
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Failed to get automod events:', error);
    return NextResponse.json({ error: 'Failed to get automod events' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await clearChatAutomodEvents();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear automod events:', error);
    return NextResponse.json({ error: 'Failed to clear automod events' }, { status: 500 });
  }
}
