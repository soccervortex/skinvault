import { NextResponse } from 'next/server';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

export async function GET(request: Request) {
  // Derive protocol from the actual request URL and X-Forwarded-Proto
  const url = new URL(request.url);
  const host = url.host;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protoFromUrl = url.protocol.replace(':', '');
  const protocol = forwardedProto || protoFromUrl || 'http';

  const returnUrl = `${protocol}://${host}/inventory`;

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

