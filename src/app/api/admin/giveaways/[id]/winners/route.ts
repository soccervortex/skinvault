import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDatabase();
    const winnersCol = db.collection('giveaway_winners');
    const settingsCol = db.collection('user_settings');

    const w: any = await winnersCol.findOne({ _id: id } as any);
    const winners = Array.isArray(w?.winners) ? w.winners : [];

    const steamIds = winners.map((x: any) => String(x?.steamId || '')).filter((x: string) => /^\d{17}$/.test(x));
    const settings = steamIds.length
      ? await settingsCol.find({ _id: { $in: steamIds } } as any, { projection: { _id: 1, tradeUrl: 1 } }).toArray()
      : [];

    const tradeUrlBySteamId = new Map<string, string>();
    for (const s of settings as any[]) {
      tradeUrlBySteamId.set(String(s?._id || ''), String(s?.tradeUrl || ''));
    }

    const out = winners.map((x: any) => ({
      steamId: String(x?.steamId || ''),
      entries: Number(x?.entries || 0),
      tradeUrl: tradeUrlBySteamId.get(String(x?.steamId || '')) || '',
    }));

    return NextResponse.json({ ok: true, winners: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load winners' }, { status: 500 });
  }
}
