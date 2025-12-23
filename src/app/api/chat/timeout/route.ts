import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';

const TIMEOUT_USERS_KEY = 'timeout_users';

// Timeout durations in milliseconds
const TIMEOUT_DURATIONS: Record<string, number> = {
  '1min': 1 * 60 * 1000,
  '5min': 5 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '60min': 60 * 60 * 1000,
  '1day': 24 * 60 * 60 * 1000,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { steamId, duration, adminSteamId } = body;

    // Verify admin
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!steamId || !duration || !TIMEOUT_DURATIONS[duration]) {
      return NextResponse.json({ 
        error: 'Invalid parameters. Duration must be: 1min, 5min, 30min, 60min, or 1day' 
      }, { status: 400 });
    }

    const timeoutUsers = await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY) || {};
    const timeoutUntil = new Date(Date.now() + TIMEOUT_DURATIONS[duration]);
    
    timeoutUsers[steamId] = timeoutUntil.toISOString();
    const success = await dbSet(TIMEOUT_USERS_KEY, timeoutUsers);
    
    if (!success) {
      console.error(`[Timeout] Failed to save timeout for ${steamId}`);
      return NextResponse.json({ error: 'Failed to save timeout' }, { status: 500 });
    }
    
    // Verify the timeout was saved
    const verify = await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY);
    if (!verify || !verify[steamId]) {
      console.error(`[Timeout] Verification failed - timeout not found for ${steamId}`);
      return NextResponse.json({ error: 'Timeout verification failed' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `User ${steamId} timed out for ${duration}`,
      timeoutUntil: timeoutUntil.toISOString(),
    });
  } catch (error) {
    console.error('Failed to timeout user:', error);
    return NextResponse.json({ error: 'Failed to timeout user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');
    const adminSteamId = searchParams.get('adminSteamId');

    // Verify admin
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const timeoutUsers = await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY) || {};
    delete timeoutUsers[steamId];
    await dbSet(TIMEOUT_USERS_KEY, timeoutUsers);

    return NextResponse.json({ success: true, message: `Timeout removed for ${steamId}` });
  } catch (error) {
    console.error('Failed to remove timeout:', error);
    return NextResponse.json({ error: 'Failed to remove timeout' }, { status: 500 });
  }
}

