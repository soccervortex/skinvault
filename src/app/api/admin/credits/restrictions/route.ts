import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { dbGet, dbSet } from '@/app/utils/database';
import { getCreditsRestrictionStatus } from '@/app/utils/credits-restrictions';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

const CREDITS_BANNED_KEY = 'credits_banned_steam_ids';
const CREDITS_TIMEOUT_USERS_KEY = 'credits_timeout_users';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    const status = await getCreditsRestrictionStatus(steamId);
    return NextResponse.json({ ok: true, steamId, ...status }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load restrictions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const steamId = sanitizeSteamId(body?.steamId) || null;
    const action = String(body?.action || '').trim();

    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

    if (action === 'ban' || action === 'unban') {
      const banned = (await dbGet<string[]>(CREDITS_BANNED_KEY, false)) || [];
      const list = Array.isArray(banned) ? banned.slice() : [];
      const has = list.includes(steamId);
      if (action === 'ban' && !has) list.push(steamId);
      if (action === 'unban' && has) {
        const next = list.filter((x) => x !== steamId);
        await dbSet(CREDITS_BANNED_KEY, next);
      } else {
        await dbSet(CREDITS_BANNED_KEY, list);
      }
    } else if (action === 'timeout') {
      const minutes = Math.floor(Number(body?.minutes || 0));
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60 * 24 * 365) {
        return NextResponse.json({ error: 'Invalid minutes' }, { status: 400 });
      }
      const timeoutUsers = (await dbGet<Record<string, string>>(CREDITS_TIMEOUT_USERS_KEY, false)) || {};
      const map: Record<string, string> = typeof timeoutUsers === 'object' && timeoutUsers ? { ...timeoutUsers } : {};
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      map[steamId] = until;
      await dbSet(CREDITS_TIMEOUT_USERS_KEY, map);
    } else if (action === 'clear_timeout') {
      const timeoutUsers = (await dbGet<Record<string, string>>(CREDITS_TIMEOUT_USERS_KEY, false)) || {};
      const map: Record<string, string> = typeof timeoutUsers === 'object' && timeoutUsers ? { ...timeoutUsers } : {};
      delete map[steamId];
      await dbSet(CREDITS_TIMEOUT_USERS_KEY, map);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    try {
      if (hasMongoConfig()) {
        const db = await getDatabase();
        const meta = { bySteamId: adminSteamId };

        if (action === 'ban') {
          await createUserNotification(
            db,
            steamId,
            'credits_banned',
            'Credits Access Banned',
            'Your credits access was banned by staff. You cannot earn or spend credits while banned.',
            meta
          );
        }

        if (action === 'unban') {
          await createUserNotification(
            db,
            steamId,
            'credits_unbanned',
            'Credits Access Restored',
            'Your credits access ban was lifted. You can earn and spend credits again.',
            meta
          );
        }

        if (action === 'timeout') {
          const minutes = Math.floor(Number(body?.minutes || 0));
          const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
          await createUserNotification(
            db,
            steamId,
            'credits_timeout',
            'Credits Access Timeout',
            `Your credits access is temporarily restricted until ${until}.`,
            { ...meta, timeoutUntil: until, minutes }
          );
        }

        if (action === 'clear_timeout') {
          await createUserNotification(
            db,
            steamId,
            'credits_timeout_cleared',
            'Credits Access Restored',
            'Your credits access timeout was removed. You can earn and spend credits again.',
            meta
          );
        }
      }
    } catch {
    }

    const status = await getCreditsRestrictionStatus(steamId);
    return NextResponse.json({ ok: true, steamId, ...status }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update restrictions' }, { status: 500 });
  }
}
