import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

export const runtime = 'nodejs';

function normalizeItem(raw: any) {
  const assetId = String(raw?.assetId || raw?.assetid || '').trim();
  const classId = String(raw?.classId || raw?.classid || '').trim();
  const instanceId = String(raw?.instanceId || raw?.instanceid || '').trim();
  const appId = Math.max(1, Math.floor(Number(raw?.appId || raw?.appid || process.env.STEAM_APP_ID || 730)));
  const contextId = String(raw?.contextId || raw?.contextid || process.env.STEAM_CONTEXT_ID || '2').trim() || '2';
  const market_hash_name = String(raw?.market_hash_name || raw?.marketHashName || '').trim();
  const name = String(raw?.name || '').trim();

  if (!assetId) return null;

  return {
    assetId,
    classId: classId || null,
    instanceId: instanceId || null,
    appId,
    contextId,
    market_hash_name: market_hash_name || null,
    name: name || null,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const db = await getDatabase();
    const col = db.collection('giveaway_prize_stock');

    const rows = await col
      .find({ giveawayId } as any)
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray();

    const out = (rows as any[]).map((r) => ({
      id: String(r?._id || ''),
      assetId: String(r?.assetId || ''),
      classId: r?.classId ? String(r.classId) : null,
      instanceId: r?.instanceId ? String(r.instanceId) : null,
      appId: Number(r?.appId || 730),
      contextId: String(r?.contextId || '2'),
      market_hash_name: r?.market_hash_name ? String(r.market_hash_name) : null,
      name: r?.name ? String(r.name) : null,
      status: String(r?.status || 'AVAILABLE'),
      reservedBySteamId: r?.reservedBySteamId ? String(r.reservedBySteamId) : null,
      steamTradeOfferId: r?.steamTradeOfferId ? String(r.steamTradeOfferId) : null,
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
      updatedAt: r?.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    }));

    return NextResponse.json({ ok: true, giveawayId: id, stock: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load stock' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const itemsRaw = Array.isArray(body?.items) ? body.items : [];

    const normalized = itemsRaw.map(normalizeItem).filter(Boolean) as any[];
    if (!normalized.length) return NextResponse.json({ error: 'No items provided' }, { status: 400 });

    const db = await getDatabase();
    const col = db.collection('giveaway_prize_stock');

    const now = new Date();
    const docs = normalized.map((x) => ({
      giveawayId,
      assetId: x.assetId,
      classId: x.classId,
      instanceId: x.instanceId,
      appId: x.appId,
      contextId: x.contextId,
      market_hash_name: x.market_hash_name,
      name: x.name,
      status: 'AVAILABLE',
      createdAt: now,
      updatedAt: now,
      createdBy: steamId,
    }));

    const res = await col.insertMany(docs as any, { ordered: false });
    return NextResponse.json({ ok: true, inserted: Object.keys(res.insertedIds || {}).length }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message || 'Failed to add stock');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
