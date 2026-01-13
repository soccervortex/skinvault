import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabase } from '@/app/utils/mongodb-client';

type ObsVaultCacheDoc = {
  _id: string;
  steamId: string;
  currency: number;
  total: string;
  updatedAt: Date;
};

function verifyObsToken(token: string, secret: string): { steamId: string; exp: number } | null {
  const t = String(token || '').trim();
  const [payload, sig] = t.split('.');
  if (!payload || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const steamId = String(json?.steamId || '').trim();
    const exp = Number(json?.exp || 0);
    if (!steamId || !Number.isFinite(exp) || exp <= 0) return null;
    return { steamId, exp };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get('token') || '').trim();
  const currencyParam = String(url.searchParams.get('currency') || '').trim();
  const currency = currencyParam === '1' ? 1 : 3;

  const obsSecret = String(process.env.OBS_OVERLAY_SECRET || '').trim();
  if (!obsSecret) return NextResponse.json({ error: 'OBS_OVERLAY_SECRET not configured' }, { status: 500 });

  const parsed = verifyObsToken(token, obsSecret);
  if (!parsed) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  if (Date.now() > parsed.exp) return NextResponse.json({ error: 'Token expired' }, { status: 401 });

  const steamId = parsed.steamId;

  try {
    const db = await getDatabase();
    const col = db.collection<ObsVaultCacheDoc>('obs_vault_cache');

    const cacheId = `${steamId}_${currency}`;
    const cached = await col.findOne({ _id: cacheId });
    const now = Date.now();

    if (cached?.updatedAt) {
      const age = now - new Date(cached.updatedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < 55_000 && typeof cached.total === 'string') {
        return NextResponse.json(
          {
            steamId,
            currency: currency === 1 ? 'USD' : 'EUR',
            total: cached.total,
            updatedAt: new Date(cached.updatedAt).toISOString(),
          },
          { status: 200 }
        );
      }
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL || url.origin;
    const invUrl = `${origin.replace(/\/$/, '')}/api/steam/inventory?steamId=${encodeURIComponent(steamId)}&currency=${currency}`;

    let total = '0.00';
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 25_000);
      try {
        const res = await fetch(invUrl, { cache: 'no-store', signal: controller.signal });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json && typeof json.totalInventoryValue === 'string') {
            total = json.totalInventoryValue;
          }
        }
      } finally {
        clearTimeout(id);
      }
    } catch {
      total = '0.00';
    }

    const updatedAt = new Date();
    await col.updateOne(
      { _id: cacheId },
      {
        $set: {
          _id: cacheId,
          steamId,
          currency,
          total,
          updatedAt,
        },
      },
      { upsert: true }
    );

    return NextResponse.json(
      {
        steamId,
        currency: currency === 1 ? 'USD' : 'EUR',
        total,
        updatedAt: updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        steamId,
        currency: currency === 1 ? 'USD' : 'EUR',
        total: '0.00',
        updatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
