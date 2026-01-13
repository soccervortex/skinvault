import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { sanitizeSteamId } from '@/app/utils/sanitize';

type UserSettingsDoc = {
  _id: string;
  steamId: string;
  tradeUrl?: string;
  updatedAt: Date;
};

function normalizeTradeUrl(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.length > 500) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  if (!/steamcommunity\.com\/tradeoffer\/new\//i.test(s)) return '';
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get('steamId');

    const requested = raw ? sanitizeSteamId(raw) : null;
    const steamId = requested || getSteamIdFromRequest(req);
    if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDatabase();
    const col = db.collection<UserSettingsDoc>('user_settings');
    const doc = await col.findOne({ _id: steamId });
    return NextResponse.json({ steamId, tradeUrl: String(doc?.tradeUrl || '') }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load trade url' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const tradeUrl = normalizeTradeUrl(body?.tradeUrl);

    const db = await getDatabase();
    const col = db.collection<UserSettingsDoc>('user_settings');
    const now = new Date();

    await col.updateOne(
      { _id: steamId },
      {
        $setOnInsert: { _id: steamId, steamId, updatedAt: now },
        $set: { tradeUrl: tradeUrl || '', updatedAt: now },
      },
      { upsert: true }
    );

    return NextResponse.json({ steamId, tradeUrl: tradeUrl || '' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save trade url' }, { status: 500 });
  }
}
