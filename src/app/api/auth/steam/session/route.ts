import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'sv_steam_session';

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env as any).AUTH_SECRET ||
    (process.env as any).JWT_SECRET ||
    ''
  );
}

function verifyCookie(value: string, secret: string): { steamId: string } | null {
  const v = String(value || '');
  const [payload, sig] = v.split('.');
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
    if (!steamId) return null;
    return { steamId };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value || '';
  const secret = getSessionSecret();
  if (!cookie || !secret) return NextResponse.json({ steamId: null }, { status: 200 });

  const data = verifyCookie(cookie, secret);
  return NextResponse.json({ steamId: data?.steamId || null }, { status: 200 });
}
