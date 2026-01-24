import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

const ADMIN_HEADER = 'x-admin-key';

export const runtime = 'nodejs';

type Action = 'add' | 'delete';

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterSteamId = getSteamIdFromRequest(request);
    if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);

    const action = String(body?.action || '').trim().toLowerCase() as Action;
    const referrerSteamId = sanitizeSteamId(body?.referrerSteamId);
    const referredSteamId = sanitizeSteamId(body?.referredSteamId);

    if (action !== 'add' && action !== 'delete') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!referrerSteamId || !referredSteamId) {
      return NextResponse.json({ error: 'Invalid referrerSteamId or referredSteamId' }, { status: 400 });
    }

    if (referrerSteamId === referredSteamId) {
      return NextResponse.json({ error: 'referrerSteamId and referredSteamId must be different' }, { status: 400 });
    }

    const db = await getDatabase();
    const referralsCol = db.collection('affiliate_referrals');

    if (action === 'add') {
      const now = new Date();
      const upd = await referralsCol.updateOne(
        { _id: referredSteamId } as any,
        {
          $setOnInsert: {
            _id: referredSteamId,
            createdAt: now,
          },
          $set: {
            referredSteamId,
            referrerSteamId,
            updatedAt: now,
          },
        } as any,
        { upsert: true } as any
      );

      return NextResponse.json(
        {
          ok: true,
          action,
          referrerSteamId,
          referredSteamId,
          upserted: !!(upd as any)?.upsertedCount,
          modified: Number((upd as any)?.modifiedCount || 0),
        },
        { status: 200 }
      );
    }

    const del = await referralsCol.deleteOne({ _id: referredSteamId, referrerSteamId } as any);
    return NextResponse.json(
      {
        ok: true,
        action,
        referrerSteamId,
        referredSteamId,
        deleted: Number((del as any)?.deletedCount || 0),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update affiliate referrals' }, { status: 500 });
  }
}
