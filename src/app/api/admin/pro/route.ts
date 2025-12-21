import { NextResponse } from 'next/server';
import { grantPro } from '@/app/utils/pro-storage';
import { sanitizeSteamId } from '@/app/utils/sanitize';

const ADMIN_HEADER = 'x-admin-key';

export async function POST(request: Request) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    // If an ADMIN_PRO_TOKEN is configured, require it.
    // If it's not set (e.g. local dev), allow the request.
    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawSteamId = body?.steamId as string | undefined;
    const months = Number(body?.months ?? 0);

    // Sanitize and validate SteamID
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    // Validate months
    if (!months || months <= 0 || months > 120) {
      return NextResponse.json({ error: 'Invalid months value (must be between 1 and 120)' }, { status: 400 });
    }

    const proUntil = await grantPro(steamId, months);
    return NextResponse.json({ steamId, proUntil });
  } catch (error) {
    console.error('Failed to grant Pro:', error);
    return NextResponse.json({ error: 'Failed to grant Pro' }, { status: 500 });
  }
}

