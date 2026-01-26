import { NextResponse } from 'next/server';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

export async function GET(request: Request) {
  // Derive protocol from the actual request URL and X-Forwarded-Proto
  const url = new URL(request.url);
  const forwardedProtoRaw = request.headers.get('x-forwarded-proto');
  const forwardedProto = forwardedProtoRaw ? String(forwardedProtoRaw).split(',')[0].trim() : '';
  const protoFromUrl = url.protocol.replace(':', '');
  const protocol = forwardedProto || protoFromUrl || 'http';

  const forwardedHostRaw = request.headers.get('x-forwarded-host');
  const forwardedHost = forwardedHostRaw ? String(forwardedHostRaw).split(',')[0].trim() : '';
  const hostHeader = String(request.headers.get('host') || '').trim();
  const hostFromHeaders = forwardedHost || hostHeader;

  const fallbackBase = String(process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  const fallbackHost = (() => {
    if (!fallbackBase) return '';
    try {
      return new URL(fallbackBase).host;
    } catch {
      return '';
    }
  })();

  const host = (() => {
    const h = hostFromHeaders || url.host;
    const lower = String(h).toLowerCase();
    if (lower.includes('localhost') || lower.startsWith('127.0.0.1') || lower.startsWith('0.0.0.0')) {
      return fallbackHost || h;
    }
    return h;
  })();

  const returnUrl = `${protocol}://${host}/api/auth/steam/callback`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': `${protocol}://${host}`,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return NextResponse.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
}

