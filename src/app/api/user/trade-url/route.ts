import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { sanitizeSteamId } from '@/app/utils/sanitize';

export const runtime = 'nodejs';

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

  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (u.hostname !== 'steamcommunity.com') return '';
    if (u.pathname !== '/tradeoffer/new/') return '';
    const partner = u.searchParams.get('partner');
    const token = u.searchParams.get('token');
    if (!partner || !/^\d+$/.test(partner)) return '';
    if (!token || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) return '';
    return u.toString();
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get('steamId');

    const requested = raw ? sanitizeSteamId(raw) : null;
    const steamId = requested || getSteamIdFromRequest(req);
    if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const col = db.collection<UserSettingsDoc>('user_settings');
    const doc = await col.findOne({ _id: steamId });
    return NextResponse.json({ steamId, tradeUrl: String(doc?.tradeUrl || '') }, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/user/trade-url failed', { name: e?.name, code: e?.code, message: e?.message });
    return NextResponse.json({ error: e?.message || 'Failed to load trade url' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const raw = String(body?.tradeUrl || '').trim();
    const tradeUrl = normalizeTradeUrl(raw);

    if (raw && !tradeUrl) {
      return NextResponse.json(
        {
          error:
            'Invalid trade URL. Use: https://steamcommunity.com/tradeoffer/new/?partner=...&token=... (partner + token required)',
        },
        { status: 400 }
      );
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const db = await getDatabase();
    const col = db.collection<UserSettingsDoc>('user_settings');
    const now = new Date();

    await col.updateOne(
      { _id: steamId },
      {
        $setOnInsert: { _id: steamId, steamId },
        $set: { tradeUrl: tradeUrl || '', updatedAt: now },
      },
      { upsert: true }
    );

    return NextResponse.json({ steamId, tradeUrl: tradeUrl || '' }, { status: 200 });
  } catch (e: any) {
    console.error('POST /api/user/trade-url failed', { name: e?.name, code: e?.code, message: e?.message });
    return NextResponse.json({ error: e?.message || 'Failed to save trade url' }, { status: 500 });
  }
}
