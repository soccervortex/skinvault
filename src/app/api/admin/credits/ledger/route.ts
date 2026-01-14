import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';

type CreditsLedgerDoc = {
  steamId: string;
  delta: number;
  type: string;
  createdAt: Date;
  meta?: any;
};

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const adminSteamId = getSteamIdFromRequest(req);
  if (!adminSteamId || !isOwner(adminSteamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(req.url);
    const steamId = sanitizeSteamId(url.searchParams.get('steamId'));
    if (!steamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    const rawLimit = Number(url.searchParams.get('limit') || 200);
    const limit = Math.min(500, Math.max(1, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 200)));

    const db = await getDatabase();
    const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');

    const rows = await ledgerCol
      .find({ steamId } as any)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const out = rows.map((r: any) => ({
      id: r?._id ? String(r._id) : '',
      steamId: String(r?.steamId || ''),
      delta: Number(r?.delta || 0),
      type: String(r?.type || ''),
      createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
      meta: r?.meta ?? null,
    }));

    return NextResponse.json({ ok: true, steamId, entries: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load ledger' }, { status: 500 });
  }
}
