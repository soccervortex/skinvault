import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

const TIMEOUT_USERS_KEY = 'timeout_users';
const TIMEOUT_REASONS_KEY = 'timeout_reasons';

// Timeout durations in milliseconds
const TIMEOUT_DURATIONS: Record<string, number> = {
  '1min': 1 * 60 * 1000,
  '5min': 5 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '60min': 60 * 60 * 1000,
  '1day': 24 * 60 * 60 * 1000,
};

function normalizeDurationKey(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (TIMEOUT_DURATIONS[s]) return s;
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const minutes = Math.floor(n);
  if (minutes <= 1) return '1min';
  if (minutes <= 5) return '5min';
  if (minutes <= 30) return '30min';
  if (minutes <= 60) return '60min';
  return '1day';
}

export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { steamId } = body;
    const durationKey = normalizeDurationKey(body?.duration ?? body?.minutes);

    if (!steamId || !durationKey || !TIMEOUT_DURATIONS[durationKey]) {
      return NextResponse.json({ 
        error: 'Invalid parameters. Duration must be: 1min, 5min, 30min, 60min, or 1day' 
      }, { status: 400 });
    }

    const timeoutUsers = await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY) || {};
    const timeoutUntil = new Date(Date.now() + TIMEOUT_DURATIONS[durationKey]);
    
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

    const reason = String(body?.timeoutReason || body?.reason || '').trim();
    if (reason) {
      try {
        const reasons = (await dbGet<Record<string, any>>(TIMEOUT_REASONS_KEY, false)) || {};
        const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
        next[String(steamId)] = {
          reason,
          at: new Date().toISOString(),
          by: null,
        };
        await dbSet(TIMEOUT_REASONS_KEY, next);
      } catch {
      }
    }

    try {
      if (hasMongoConfig() && /^\d{17}$/.test(String(steamId || '').trim())) {
        const db = await getDatabase();
        const untilIso = timeoutUntil.toISOString();
        await createUserNotification(
          db,
          String(steamId),
          'chat_timeout',
          'Chat Timeout',
          reason
            ? `You have been timed out from chat until ${untilIso}. Reason: ${reason}`
            : `You have been timed out from chat until ${untilIso}.`,
          { bySteamId: null, timeoutUntil: untilIso, duration: durationKey }
        );
      }
    } catch {
    }

    return NextResponse.json({ 
      success: true, 
      message: `User ${steamId} timed out for ${durationKey}`,
      timeoutUntil: timeoutUntil.toISOString(),
    });
  } catch (error) {
    console.error('Failed to timeout user:', error);
    return NextResponse.json({ error: 'Failed to timeout user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const timeoutUsers = await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY) || {};
    delete timeoutUsers[steamId];
    await dbSet(TIMEOUT_USERS_KEY, timeoutUsers);

    try {
      const reasons = (await dbGet<Record<string, any>>(TIMEOUT_REASONS_KEY, false)) || {};
      const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
      delete next[String(steamId)];
      await dbSet(TIMEOUT_REASONS_KEY, next);
    } catch {
    }

    try {
      if (hasMongoConfig() && /^\d{17}$/.test(String(steamId || '').trim())) {
        const db = await getDatabase();
        await createUserNotification(
          db,
          String(steamId),
          'chat_timeout_removed',
          'Chat Timeout Removed',
          'Your chat timeout was removed. You can chat again.',
          { bySteamId: null }
        );
      }
    } catch {
    }

    return NextResponse.json({ success: true, message: `Timeout removed for ${steamId}` });
  } catch (error) {
    console.error('Failed to remove timeout:', error);
    return NextResponse.json({ error: 'Failed to remove timeout' }, { status: 500 });
  }
}

