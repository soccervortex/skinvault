import { NextResponse } from 'next/server';

import { dbGet, dbSet } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

const ADMIN_API_TOKEN = process.env.DISCORD_BOT_API_TOKEN;

const BANNED_KEY = 'banned_steam_ids';
const BAN_REASONS_KEY = 'ban_reasons';

const TIMEOUT_USERS_KEY = 'timeout_users';
const TIMEOUT_REASONS_KEY = 'timeout_reasons';

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

export async function POST(request: Request) {
  const authToken = request.headers.get('Authorization');
  if (!ADMIN_API_TOKEN || authToken !== `Bearer ${ADMIN_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, steamId, reason, duration, actingAdminSteamId } = body;

  if (!action || !steamId) {
    return NextResponse.json({ error: 'Missing action or steamId' }, { status: 400 });
  }

  try {
    const sid = sanitizeSteamId(String(steamId || '').trim());
    if (!sid) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    const adminSidRaw = String(actingAdminSteamId || '').trim();
    if (!adminSidRaw || !isOwner(adminSidRaw)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cleanReason = String(reason || '').trim();

    if (action === 'ban') {
      const banned = (await dbGet<string[]>(BANNED_KEY)) || [];
      if (!banned.includes(sid)) {
        banned.push(sid);
        await dbSet(BANNED_KEY, banned);
      }

      if (cleanReason) {
        try {
          const reasons = (await dbGet<Record<string, any>>(BAN_REASONS_KEY, false)) || {};
          const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
          next[sid] = { reason: cleanReason, at: new Date().toISOString(), by: adminSidRaw };
          await dbSet(BAN_REASONS_KEY, next);
        } catch {
        }
      }

      return NextResponse.json({ success: true, message: `User ${sid} has been banned on the website.` });
    }

    if (action === 'unban') {
      const banned = (await dbGet<string[]>(BANNED_KEY)) || [];
      const updated = banned.filter((x) => x !== sid);
      await dbSet(BANNED_KEY, updated);

      try {
        const reasons = (await dbGet<Record<string, any>>(BAN_REASONS_KEY, false)) || {};
        const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
        delete next[sid];
        await dbSet(BAN_REASONS_KEY, next);
      } catch {
      }

      return NextResponse.json({ success: true, message: `User ${sid} has been unbanned on the website.` });
    }

    if (action === 'timeout') {
      const key = normalizeDurationKey(duration);
      if (!key) return NextResponse.json({ error: 'Timeout duration is required' }, { status: 400 });
      const ms = TIMEOUT_DURATIONS[key];

      const timeoutUsers = (await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY)) || {};
      const timeoutUntil = new Date(Date.now() + ms);
      timeoutUsers[sid] = timeoutUntil.toISOString();
      await dbSet(TIMEOUT_USERS_KEY, timeoutUsers);

      if (cleanReason) {
        try {
          const reasons = (await dbGet<Record<string, any>>(TIMEOUT_REASONS_KEY, false)) || {};
          const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
          next[sid] = { reason: cleanReason, at: new Date().toISOString(), by: adminSidRaw };
          await dbSet(TIMEOUT_REASONS_KEY, next);
        } catch {
        }
      }

      return NextResponse.json({
        success: true,
        message: `User ${sid} has been timed out on the website for ${key}.`,
        timeoutUntil: timeoutUntil.toISOString(),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error(`[Discord Moderation API] Failed to execute '${action}' for ${steamId}:`, error);
    return NextResponse.json({ error: error.message || 'An internal error occurred' }, { status: 500 });
  }
}