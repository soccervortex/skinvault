import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { isOwnerRequest } from '@/app/utils/admin-auth';

const GLOBAL_CHAT_DISABLED_KEY = 'global_chat_disabled';
const DM_CHAT_DISABLED_KEY = 'dm_chat_disabled';

// GET: Get chat control status
export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const globalChatDisabled = (await dbGet<boolean>(GLOBAL_CHAT_DISABLED_KEY, false)) || false;
    const dmChatDisabled = (await dbGet<boolean>(DM_CHAT_DISABLED_KEY, false)) || false;

    return NextResponse.json({
      globalChatDisabled,
      dmChatDisabled,
    });
  } catch (error) {
    console.error('Failed to get chat control status:', error);
    return NextResponse.json({ error: 'Failed to get chat control status' }, { status: 500 });
  }
}

// POST: Update chat control status
export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { globalChatDisabled, dmChatDisabled } = body;

    if (typeof globalChatDisabled === 'boolean') {
      await dbSet(GLOBAL_CHAT_DISABLED_KEY, globalChatDisabled);
    }

    if (typeof dmChatDisabled === 'boolean') {
      await dbSet(DM_CHAT_DISABLED_KEY, dmChatDisabled);
    }

    return NextResponse.json({
      success: true,
      globalChatDisabled: typeof globalChatDisabled === 'boolean' ? globalChatDisabled : (await dbGet<boolean>(GLOBAL_CHAT_DISABLED_KEY, false)) || false,
      dmChatDisabled: typeof dmChatDisabled === 'boolean' ? dmChatDisabled : (await dbGet<boolean>(DM_CHAT_DISABLED_KEY, false)) || false,
    });
  } catch (error) {
    console.error('Failed to update chat control status:', error);
    return NextResponse.json({ error: 'Failed to update chat control status' }, { status: 500 });
  }
}

