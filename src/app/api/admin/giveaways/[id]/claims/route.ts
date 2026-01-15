import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

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
    const claimsCol = db.collection('giveaway_claims');

    const rows = await claimsCol
      .find(
        { giveawayId } as any,
        {
          projection: {
            _id: 1,
            giveawayId: 1,
            steamId: 1,
            tradeStatus: 1,
            steamTradeOfferId: 1,
            lastError: 1,
            botLockedAt: 1,
            botLockId: 1,
            prizeStockId: 1,
            itemId: 1,
            assetId: 1,
            classId: 1,
            instanceId: 1,
            assetAppIdExact: 1,
            assetContextIdExact: 1,
            createdAt: 1,
            updatedAt: 1,
            sentAt: 1,
            completedAt: 1,
          },
        }
      )
      .sort({ updatedAt: -1 })
      .limit(250)
      .toArray();

    const out = (rows as any[]).map((r) => ({
      id: String(r?._id || ''),
      steamId: String(r?.steamId || ''),
      tradeStatus: String(r?.tradeStatus || ''),
      steamTradeOfferId: r?.steamTradeOfferId ? String(r.steamTradeOfferId) : null,
      lastError: r?.lastError ? String(r.lastError) : null,
      botLockedAt: r?.botLockedAt ? new Date(r.botLockedAt).toISOString() : null,
      botLockId: r?.botLockId ? String(r.botLockId) : null,
      prizeStockId: r?.prizeStockId ? String(r.prizeStockId) : null,
      itemId: r?.itemId ? String(r.itemId) : null,
      assetId: r?.assetId ? String(r.assetId) : null,
      classId: r?.classId ? String(r.classId) : null,
      instanceId: r?.instanceId ? String(r.instanceId) : null,
      assetAppIdExact: typeof r?.assetAppIdExact === 'number' ? r.assetAppIdExact : r?.assetAppIdExact ? Number(r.assetAppIdExact) : null,
      assetContextIdExact: r?.assetContextIdExact ? String(r.assetContextIdExact) : null,
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
      updatedAt: r?.updatedAt ? new Date(r.updatedAt).toISOString() : null,
      sentAt: r?.sentAt ? new Date(r.sentAt).toISOString() : null,
      completedAt: r?.completedAt ? new Date(r.completedAt).toISOString() : null,
    }));

    return NextResponse.json({ ok: true, giveawayId: id, claims: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load claims' }, { status: 500 });
  }
}
