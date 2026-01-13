import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/app/utils/mongodb-client';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = await getDatabase();
    const col = db.collection('giveaways');

    const doc = await col.findOne({ _id: new ObjectId(id) } as any);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const now = new Date();
    const startAt = doc.startAt ? new Date(doc.startAt) : null;
    const endAt = doc.endAt ? new Date(doc.endAt) : null;
    const isActive = !!(startAt && endAt && startAt <= now && endAt > now && !doc.drawnAt);

    return NextResponse.json(
      {
        giveaway: {
          id: String(doc._id),
          title: String(doc.title || ''),
          description: String(doc.description || ''),
          prize: String(doc.prize || ''),
          startAt: startAt ? startAt.toISOString() : null,
          endAt: endAt ? endAt.toISOString() : null,
          creditsPerEntry: Number(doc.creditsPerEntry || 10),
          winnerCount: Number(doc.winnerCount || 1),
          totalEntries: Number(doc.totalEntries || 0),
          totalParticipants: Number(doc.totalParticipants || 0),
          isActive,
          drawnAt: doc.drawnAt ? new Date(doc.drawnAt).toISOString() : null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load giveaway' }, { status: 500 });
  }
}
