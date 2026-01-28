import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { DEFAULT_CHAT_AUTOMOD_SETTINGS, coerceChatAutomodSettings } from '@/app/utils/chat-automod';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

const SETTINGS_KEY = 'chat_automod_settings';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const raw = (await dbGet<any>(SETTINGS_KEY, false)) ?? null;
    const settings = coerceChatAutomodSettings(raw || DEFAULT_CHAT_AUTOMOD_SETTINGS);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to get chat automod settings:', error);
    return NextResponse.json({ error: 'Failed to get automod settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const settings = coerceChatAutomodSettings(body?.settings);
    await dbSet(SETTINGS_KEY, settings);

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to update chat automod settings:', error);
    return NextResponse.json({ error: 'Failed to update automod settings' }, { status: 500 });
  }
}
