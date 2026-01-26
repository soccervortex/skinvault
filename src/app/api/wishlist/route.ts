import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { sanitizeSteamId } from '@/app/utils/sanitize';

export const runtime = 'nodejs';

type WishlistEntry = {
  key: string;
  name?: string;
  image?: string;
  market_hash_name?: string;
  rarityName?: string;
  rarityColor?: string;
  weaponName?: string;
};

type WishlistDoc = {
  _id: string;
  steamId: string;
  wishlist: WishlistEntry[];
  updatedAt: Date;
};

function isBotAuthorized(req: NextRequest): boolean {
  const expected = process.env.DISCORD_BOT_API_TOKEN;
  if (!expected) return false;
  const header = String(req.headers.get('authorization') || '').trim();
  return header === `Bearer ${expected}`;
}

function normalizeEntries(raw: any): WishlistEntry[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: WishlistEntry[] = [];
  for (const e of arr) {
    const key = String(e?.key || '').trim();
    if (!key) continue;
    out.push({
      key,
      name: e?.name != null ? String(e.name).slice(0, 200) : undefined,
      image: e?.image != null ? String(e.image).slice(0, 2000) : undefined,
      market_hash_name: e?.market_hash_name != null ? String(e.market_hash_name).slice(0, 300) : undefined,
      rarityName: e?.rarityName != null ? String(e.rarityName).slice(0, 80) : undefined,
      rarityColor: e?.rarityColor != null ? String(e.rarityColor).slice(0, 20) : undefined,
      weaponName: e?.weaponName != null ? String(e.weaponName).slice(0, 80) : undefined,
    });
  }
  return out;
}

// Get wishlist for a user
export async function GET(req: NextRequest) {
  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(req.url);
    const requestedSteamId = sanitizeSteamId(url.searchParams.get('steamId'));

    const bot = isBotAuthorized(req);
    const requesterSteamId = getSteamIdFromRequest(req);

    const steamId = bot ? requestedSteamId : (requestedSteamId || requesterSteamId);
    if (!steamId) {
      const res = NextResponse.json({ wishlist: [], count: 0 }, { status: 200 });
      res.headers.set('cache-control', 'no-store');
      return res;
    }

    if (!bot && steamId !== requesterSteamId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDatabase();
    const col = db.collection<WishlistDoc>('wishlists');
    const doc = await col.findOne({ _id: steamId });
    const wishlist = Array.isArray(doc?.wishlist) ? doc!.wishlist : [];

    const res = NextResponse.json({ wishlist, count: wishlist.length }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error: any) {
    console.error('Get wishlist error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to get wishlist' }, { status: 500 });
  }
}

// Save wishlist (called from client + bot)
export async function POST(req: NextRequest) {
  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const wishlist = normalizeEntries(body?.wishlist);

    const bot = isBotAuthorized(req);
    const requesterSteamId = getSteamIdFromRequest(req);
    const requestedSteamId = sanitizeSteamId(body?.steamId);
    const steamId = bot ? requestedSteamId : requesterSteamId;
    if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!bot && steamId !== requesterSteamId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDatabase();
    const col = db.collection<WishlistDoc>('wishlists');
    const now = new Date();

    await col.updateOne(
      { _id: steamId },
      {
        $setOnInsert: { _id: steamId, steamId },
        $set: { wishlist, updatedAt: now },
      },
      { upsert: true }
    );

    const res = NextResponse.json({ success: true, count: wishlist.length }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (error: any) {
    console.error('Sync wishlist error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to sync wishlist' }, { status: 500 });
  }
}

