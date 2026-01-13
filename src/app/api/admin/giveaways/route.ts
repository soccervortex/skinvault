import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

function safeDate(v: any): Date | null {
  const d = new Date(String(v || ''));
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDatabase();
    const col = db.collection('giveaways');
    const rows = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray();
    const out = rows.map((g: any) => ({
      id: String(g._id),
      title: String(g.title || ''),
      prize: String(g.prize || ''),
      startAt: g.startAt ? new Date(g.startAt).toISOString() : null,
      endAt: g.endAt ? new Date(g.endAt).toISOString() : null,
      creditsPerEntry: Number(g.creditsPerEntry || 10),
      winnerCount: Number(g.winnerCount || 1),
      totalEntries: Number(g.totalEntries || 0),
      totalParticipants: Number(g.totalParticipants || 0),
      drawnAt: g.drawnAt ? new Date(g.drawnAt).toISOString() : null,
    }));
    return NextResponse.json({ giveaways: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    const prize = String(body?.prize || '').trim();
    const startAt = safeDate(body?.startAt);
    const endAt = safeDate(body?.endAt);
    const creditsPerEntry = Math.max(1, Math.floor(Number(body?.creditsPerEntry || 10)));
    const winnerCount = Math.max(1, Math.floor(Number(body?.winnerCount || 1)));

    if (!title) return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    if (!startAt || !endAt || startAt >= endAt) return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });

    const db = await getDatabase();
    const col = db.collection('giveaways');

    const now = new Date();
    const doc: any = {
      title,
      description,
      prize,
      startAt,
      endAt,
      creditsPerEntry,
      winnerCount,
      totalEntries: 0,
      totalParticipants: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: steamId,
    };

    const res = await col.insertOne(doc);
    return NextResponse.json({ ok: true, id: String(res.insertedId) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create' }, { status: 500 });
  }
}
