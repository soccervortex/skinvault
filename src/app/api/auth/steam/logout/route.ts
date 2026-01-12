import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'sv_steam_session';

function getProtocol(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto;
  const url = new URL(req.url);
  return url.protocol.replace(':', '') || 'http';
}

function getCookieDomain(req: NextRequest): string | undefined {
  const envDomain = String(process.env.COOKIE_DOMAIN || '').trim();
  if (envDomain) return envDomain;

  const host = String(req.headers.get('host') || '').trim().toLowerCase();
  if (!host) return undefined;
  if (host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0')) return undefined;

  if (host === 'skinvaults.online' || host.endsWith('.skinvaults.online')) return '.skinvaults.online';
  return undefined;
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const domain = getCookieDomain(req);
  const secure = getProtocol(req) === 'https';

  const base = {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };

  res.cookies.set({ ...base, secure });
  res.cookies.set({ ...base, secure: false });
  if (domain) {
    res.cookies.set({ ...base, secure, domain });
    res.cookies.set({ ...base, secure: false, domain });
  }
  return res;
}
