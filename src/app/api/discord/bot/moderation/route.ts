import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { getChatDatabase, hasChatMongoConfig, getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';
import { notifyUserBan, notifyUserUnban } from '@/app/utils/discord-webhook';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

function checkBotAuth(request: Request): boolean {
  const expected = String(process.env.DISCORD_BOT_API_TOKEN || '').trim();
  if (!expected) return false;
  const auth = String(request.headers.get('authorization') || '').trim();
  return auth === `Bearer ${expected}`;
}

async function steamIdFromDiscordId(discordId: string): Promise<string | null> {
  const id = String(discordId || '').trim();
  if (!id) return null;
  const connections = (await dbGet<Record<string, any>>('discord_connections', false)) || {};
  for (const [steamId, connection] of Object.entries(connections)) {
    if (!connection) continue;
    if (String((connection as any).discordId || '') !== id) continue;
    const expiresAt = Number((connection as any).expiresAt || 0);
    if (expiresAt && Date.now() > expiresAt) continue;
    return String(steamId);
  }
  return null;
}

async function purgeWebsiteChat(params: { steamId: string; days: number; includeDM: boolean }): Promise<{ globalDeleted: number; dmDeleted: number; collections: number }> {
  const steamId = String(params.steamId || '').trim();
  const days = Math.min(365, Math.max(1, Math.floor(Number(params.days || 30))));
  const includeDM = !!params.includeDM;

  if (!steamId) return { globalDeleted: 0, dmDeleted: 0, collections: 0 };
  if (!hasChatMongoConfig()) return { globalDeleted: 0, dmDeleted: 0, collections: 0 };

  const db = await getChatDatabase();
  let globalDeleted = 0;
  let dmDeleted = 0;
  let collections = 0;

  const globalCollections = getCollectionNamesForDays(days);
  for (const name of globalCollections) {
    try {
      const res = await db.collection(name).deleteMany({ steamId } as any);
      globalDeleted += Number(res?.deletedCount || 0);
      collections += 1;
    } catch {
      collections += 1;
    }
  }

  if (includeDM) {
    const dmCollections = getDMCollectionNamesForDays(days);
    for (const name of dmCollections) {
      try {
        const res = await db.collection(name).deleteMany({ senderId: steamId } as any);
        dmDeleted += Number(res?.deletedCount || 0);
        collections += 1;
      } catch {
        collections += 1;
      }
    }
  }

  return { globalDeleted, dmDeleted, collections };
}

type Action = 'ban' | 'unban' | 'timeout' | 'untimeout';

type Body = {
  action: Action;
  discordId?: string;
  steamId?: string;
  reason?: string;
  duration?: '1min' | '5min' | '30min' | '60min' | '1day';
  purgeDays?: number;
  purgeIncludeDM?: boolean;
  restrictCredits?: boolean;
};

const TIMEOUT_USERS_KEY = 'timeout_users';
const TIMEOUT_REASONS_KEY = 'timeout_reasons';
const BANNED_KEY = 'banned_steam_ids';
const BAN_REASONS_KEY = 'ban_reasons';

const CREDITS_BANNED_KEY = 'credits_banned_steam_ids';
const CREDITS_TIMEOUT_USERS_KEY = 'credits_timeout_users';

const TIMEOUT_DURATIONS: Record<string, number> = {
  '1min': 1 * 60 * 1000,
  '5min': 5 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '60min': 60 * 60 * 1000,
  '1day': 24 * 60 * 60 * 1000,
};

export async function POST(request: Request) {
  if (!checkBotAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  const action = body.action;
  const steamId = String(body.steamId || '').trim() || (await steamIdFromDiscordId(String(body.discordId || '').trim())) || '';
  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return NextResponse.json({ error: 'Steam account not connected' }, { status: 404 });
  }

  const reason = String(body.reason || '').trim();
  const purgeDays = Number.isFinite(Number(body.purgeDays)) ? Math.floor(Number(body.purgeDays)) : 0;
  const purgeIncludeDM = !!body.purgeIncludeDM;
  const restrictCredits = !!body.restrictCredits;

  if (action === 'ban') {
    const banned = (await dbGet<string[]>(BANNED_KEY, false)) || [];
    if (!banned.includes(steamId)) {
      banned.push(steamId);
      await dbSet(BANNED_KEY, banned);
      notifyUserBan(steamId, body.discordId ? String(body.discordId) : undefined).catch(() => {});

      if (reason) {
        try {
          const reasons = (await dbGet<Record<string, any>>(BAN_REASONS_KEY, false)) || {};
          const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
          next[steamId] = { reason, at: new Date().toISOString(), by: body.discordId ? String(body.discordId) : null };
          await dbSet(BAN_REASONS_KEY, next);
        } catch {
        }
      }

      try {
        if (hasMongoConfig()) {
          const db = await getDatabase();
          await createUserNotification(
            db,
            steamId,
            'user_banned',
            'You have been banned',
            reason ? `You have been banned from SkinVaults. Reason: ${reason}` : 'You have been banned from SkinVaults.',
            { byDiscordId: body.discordId ? String(body.discordId) : null, reason: reason || null }
          );
        }
      } catch {
      }

      if (restrictCredits) {
        try {
          const creditsBanned = (await dbGet<string[]>(CREDITS_BANNED_KEY, false)) || [];
          if (!creditsBanned.includes(steamId)) {
            creditsBanned.push(steamId);
            await dbSet(CREDITS_BANNED_KEY, creditsBanned);
          }
        } catch {}
      }
    }

    const purge = purgeDays > 0 ? await purgeWebsiteChat({ steamId, days: purgeDays, includeDM: purgeIncludeDM }) : { globalDeleted: 0, dmDeleted: 0, collections: 0 };
    return NextResponse.json({ ok: true, steamId, action, purge });
  }

  if (action === 'unban') {
    const banned = (await dbGet<string[]>(BANNED_KEY, false)) || [];
    const wasBanned = banned.includes(steamId);
    const updated = banned.filter((id) => id !== steamId);
    await dbSet(BANNED_KEY, updated);

    try {
      const reasons = (await dbGet<Record<string, any>>(BAN_REASONS_KEY, false)) || {};
      const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
      delete next[steamId];
      await dbSet(BAN_REASONS_KEY, next);
    } catch {
    }

    if (wasBanned) {
      notifyUserUnban(steamId, body.discordId ? String(body.discordId) : undefined).catch(() => {});
      try {
        if (hasMongoConfig()) {
          const db = await getDatabase();
          await createUserNotification(
            db,
            steamId,
            'user_unbanned',
            'You have been unbanned',
            'Your account ban has been lifted. You can now access SkinVaults again.',
            { byDiscordId: body.discordId ? String(body.discordId) : null }
          );
        }
      } catch {
      }
    }

    if (restrictCredits) {
      try {
        const creditsBanned = (await dbGet<string[]>(CREDITS_BANNED_KEY, false)) || [];
        const updatedCreditsBanned = creditsBanned.filter((id) => id !== steamId);
        await dbSet(CREDITS_BANNED_KEY, updatedCreditsBanned);
      } catch {
      }
    }

    return NextResponse.json({ ok: true, steamId, action });
  }

  if (action === 'timeout') {
    const duration = String(body.duration || '').trim();
    if (!TIMEOUT_DURATIONS[duration]) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const timeoutUsers = (await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY, false)) || {};
    const timeoutUntil = new Date(Date.now() + TIMEOUT_DURATIONS[duration]).toISOString();
    timeoutUsers[steamId] = timeoutUntil;
    await dbSet(TIMEOUT_USERS_KEY, timeoutUsers);

    if (restrictCredits) {
      try {
        const creditsTimeoutUsers = (await dbGet<Record<string, string>>(CREDITS_TIMEOUT_USERS_KEY, false)) || {};
        creditsTimeoutUsers[steamId] = timeoutUntil;
        await dbSet(CREDITS_TIMEOUT_USERS_KEY, creditsTimeoutUsers);
      } catch {}
    }

    if (reason) {
      try {
        const reasons = (await dbGet<Record<string, any>>(TIMEOUT_REASONS_KEY, false)) || {};
        const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
        next[String(steamId)] = { reason, at: new Date().toISOString(), by: body.discordId ? String(body.discordId) : null };
        await dbSet(TIMEOUT_REASONS_KEY, next);
      } catch {
      }
    }

    try {
      if (hasMongoConfig()) {
        const db = await getDatabase();
        await createUserNotification(
          db,
          steamId,
          'chat_timeout',
          'Chat Timeout',
          reason ? `You have been timed out from chat until ${timeoutUntil}. Reason: ${reason}` : `You have been timed out from chat until ${timeoutUntil}.`,
          { byDiscordId: body.discordId ? String(body.discordId) : null, timeoutUntil, duration }
        );
      }
    } catch {
    }

    return NextResponse.json({ ok: true, steamId, action, timeoutUntil });
  }

  if (action === 'untimeout') {
    const timeoutUsers = (await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY, false)) || {};
    delete timeoutUsers[steamId];
    await dbSet(TIMEOUT_USERS_KEY, timeoutUsers);

    if (restrictCredits) {
      try {
        const creditsTimeoutUsers = (await dbGet<Record<string, string>>(CREDITS_TIMEOUT_USERS_KEY, false)) || {};
        delete creditsTimeoutUsers[steamId];
        await dbSet(CREDITS_TIMEOUT_USERS_KEY, creditsTimeoutUsers);
      } catch {}
    }

    try {
      const reasons = (await dbGet<Record<string, any>>(TIMEOUT_REASONS_KEY, false)) || {};
      const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
      delete next[String(steamId)];
      await dbSet(TIMEOUT_REASONS_KEY, next);
    } catch {
    }

    try {
      if (hasMongoConfig()) {
        const db = await getDatabase();
        await createUserNotification(
          db,
          steamId,
          'chat_timeout_removed',
          'Chat Timeout Removed',
          'Your chat timeout was removed. You can chat again.',
          { byDiscordId: body.discordId ? String(body.discordId) : null }
        );
      }
    } catch {
    }

    return NextResponse.json({ ok: true, steamId, action });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}