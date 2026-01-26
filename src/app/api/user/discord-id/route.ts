import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { dbGet, dbSet } from '@/app/utils/database';

export const runtime = 'nodejs';

type UserSettingsDoc = {
  _id: string;
  steamId: string;
  tradeUrl?: string;
  discordId?: string;
  updatedAt: Date;
};

function normalizeDiscordId(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (!/^\d{17,20}$/.test(s)) return '';
  return s;
}

async function enqueueRoleSync(payload: { steamId: string; discordId?: string; reason: string }) {
  try {
    const syncQueueKey = 'discord_role_sync_queue';
    const queue = (await dbGet<Array<{ discordId?: string; steamId?: string; reason: string; timestamp: string }>>(syncQueueKey)) || [];
    queue.push({
      steamId: payload.steamId,
      discordId: payload.discordId,
      reason: payload.reason,
      timestamp: new Date().toISOString(),
    });
    if (queue.length > 200) queue.splice(0, queue.length - 200);
    await dbSet(syncQueueKey, queue);
  } catch {
  }
}

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) {
    const res = NextResponse.json({ steamId: null, discordId: '' }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  }

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const col = db.collection<UserSettingsDoc>('user_settings');
    const doc = await col.findOne({ _id: steamId } as any);
    const res = NextResponse.json({ steamId, discordId: String(doc?.discordId || '') }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    console.error('GET /api/user/discord-id failed', { name: e?.name, code: e?.code, message: e?.message });
    return NextResponse.json({ error: e?.message || 'Failed to load discord id' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const raw = String(body?.discordId || '').trim();
    const discordId = normalizeDiscordId(raw);

    if (raw && !discordId) {
      return NextResponse.json({ error: 'Invalid Discord ID. Use the numeric ID (17-20 digits).' }, { status: 400 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const col = db.collection<UserSettingsDoc>('user_settings');
    const now = new Date();

    const prev = await col.findOne({ _id: steamId } as any);
    const prevDiscordId = String((prev as any)?.discordId || '').trim();
    const nextDiscordId = String(discordId || '').trim();

    await col.updateOne(
      { _id: steamId },
      {
        $setOnInsert: { _id: steamId, steamId },
        $set: { discordId: nextDiscordId, updatedAt: now },
      },
      { upsert: true }
    );

    if (prevDiscordId !== nextDiscordId) {
      await enqueueRoleSync({ steamId, discordId: nextDiscordId || undefined, reason: 'discord_id_updated' });
    }

    return NextResponse.json({ steamId, discordId: nextDiscordId }, { status: 200 });
  } catch (e: any) {
    console.error('POST /api/user/discord-id failed', { name: e?.name, code: e?.code, message: e?.message });
    return NextResponse.json({ error: e?.message || 'Failed to save discord id' }, { status: 500 });
  }
}
