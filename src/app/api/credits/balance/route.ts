import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isProMongoOnly } from '@/app/utils/pro-status-mongo';

type UserCreditsDoc = {
  _id: string;
  steamId: string;
  balance: number;
  updatedAt: Date;
  lastDailyClaimAt?: Date;
  lastDailyClaimDay?: string;
};

function getSteamIdFromRequestOrBot(req: NextRequest): string | null {
  const sessionSteamId = getSteamIdFromRequest(req);
  if (sessionSteamId) return sessionSteamId;

  const expected = process.env.DISCORD_BOT_API_TOKEN;
  if (!expected) return null;
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) return null;

  const url = new URL(req.url);
  const fromQuery = String(url.searchParams.get('steamId') || '').trim();
  const fromHeader = String(req.headers.get('x-steam-id') || '').trim();
  const steamId = fromQuery || fromHeader;
  return /^\d{17}$/.test(steamId) ? steamId : null;
}

export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequestOrBot(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDatabase();
    const col = db.collection<UserCreditsDoc>('user_credits');
    const doc = await col.findOne({ _id: steamId });
    const balance = Number(doc?.balance || 0);
    const pro = await isProMongoOnly(steamId);
    return NextResponse.json({ steamId, balance, pro }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load balance' }, { status: 500 });
  }
}
