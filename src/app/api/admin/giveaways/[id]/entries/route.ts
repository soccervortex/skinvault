import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get('limit') || 500);
    const limit = Math.min(2000, Math.max(1, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 500)));

    const db = await getDatabase();
    const entriesCol = db.collection('giveaway_entries');
    const settingsCol = db.collection('user_settings');

    const rows: any[] = await entriesCol
      .find({ giveawayId } as any)
      .sort({ entries: -1, creditsSpent: -1 })
      .limit(limit)
      .toArray();

    const steamIds = rows.map((r) => String(r?.steamId || '')).filter((x) => /^\d{17}$/.test(x));
    const settings = steamIds.length
      ? await settingsCol.find({ _id: { $in: steamIds } } as any, { projection: { _id: 1, tradeUrl: 1 } }).toArray()
      : [];

    const tradeUrlBySteamId = new Map<string, string>();
    for (const s of settings as any[]) {
      tradeUrlBySteamId.set(String(s?._id || ''), String(s?.tradeUrl || ''));
    }

    const out = rows.map((r: any) => ({
      steamId: String(r?.steamId || ''),
      entries: Number(r?.entries || 0),
      creditsSpent: Number(r?.creditsSpent || 0),
      tradeUrl: tradeUrlBySteamId.get(String(r?.steamId || '')) || '',
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
      updatedAt: r?.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    }));

    return NextResponse.json({ ok: true, giveawayId: id, entrants: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load entrants' }, { status: 500 });
  }
}
