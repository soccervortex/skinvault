import { NextResponse } from 'next/server';
import { grantPro } from '@/app/utils/pro-storage';

const ADMIN_HEADER = 'x-admin-key';

export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  // If an ADMIN_PRO_TOKEN is configured, require it.
  // If it's not set (e.g. local dev), allow the request.
  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const steamId = body?.steamId as string | undefined;
  const months = Number(body?.months ?? 0);

  if (!steamId || !months || months <= 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const proUntil = await grantPro(steamId, months);
    return NextResponse.json({ steamId, proUntil });
  } catch (error) {
    console.error('Failed to grant Pro:', error);
    return NextResponse.json({ error: 'Failed to grant Pro' }, { status: 500 });
  }
}

