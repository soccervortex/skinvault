import crypto from 'crypto';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'sv_steam_session';

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

export function getSteamIdFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value || '';
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!cookie || !secret) return null;
  const data = verifyCookie(cookie, secret);
  const steamId = String(data?.steamId || '').trim();
  return /^\d{17}$/.test(steamId) ? steamId : null;
}
