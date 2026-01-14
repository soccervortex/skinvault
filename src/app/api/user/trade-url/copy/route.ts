import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const viewerSteamId = getSteamIdFromRequest(req);
  if (!viewerSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const profileSteamId = sanitizeSteamId(body?.steamId || body?.profileSteamId) || null;
    if (!profileSteamId) return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });

    if (profileSteamId === viewerSteamId) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const db = await getDatabase();

    await createUserNotification(
      db,
      profileSteamId,
      'trade_url_copied',
      'Trade URL Copied',
      'Someone copied your trade URL from your profile.',
      { bySteamId: viewerSteamId }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to record copy' }, { status: 500 });
  }
}
