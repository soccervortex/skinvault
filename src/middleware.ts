import { NextRequest, NextResponse } from 'next/server';

type RefCookie = {
  ref: string;
  ts: number;
  landing: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

 type AffCookie = {
  aff: string;
  ts: number;
  landing: string;
 };

function safeStr(v: string | null): string {
  return String(v || '').trim();
}

function buildRefCookie(req: NextRequest): RefCookie | null {
  const url = req.nextUrl;
  const ref = safeStr(url.searchParams.get('ref'));
  if (!ref) return null;

  const landing = `${url.pathname}${url.search ? url.search : ''}`;

  const c: RefCookie = {
    ref: ref.toLowerCase(),
    ts: Date.now(),
    landing,
  };

  const utm_source = safeStr(url.searchParams.get('utm_source'));
  const utm_medium = safeStr(url.searchParams.get('utm_medium'));
  const utm_campaign = safeStr(url.searchParams.get('utm_campaign'));
  const utm_content = safeStr(url.searchParams.get('utm_content'));
  const utm_term = safeStr(url.searchParams.get('utm_term'));

  if (utm_source) c.utm_source = utm_source;
  if (utm_medium) c.utm_medium = utm_medium;
  if (utm_campaign) c.utm_campaign = utm_campaign;
  if (utm_content) c.utm_content = utm_content;
  if (utm_term) c.utm_term = utm_term;

  return c;
}

 function buildAffCookie(req: NextRequest): AffCookie | null {
  const url = req.nextUrl;
  const aff = safeStr(url.searchParams.get('aff'));
  if (!/^\d{17}$/.test(aff)) return null;

  const landing = `${url.pathname}${url.search ? url.search : ''}`;

  return {
    aff,
    ts: Date.now(),
    landing,
  };
 }

export function middleware(req: NextRequest) {
  const host = String(req.headers.get('host') || '').trim().toLowerCase();
  if (host === 'skinvaults.online') {
    const url = req.nextUrl.clone();
    url.hostname = 'www.skinvaults.online';
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();

  const sidCookie = req.cookies.get('sv_sid')?.value;
  if (!sidCookie) {
    const sid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    res.cookies.set({
      name: 'sv_sid',
      value: sid,
      httpOnly: true,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  const refCookie = buildRefCookie(req);
  if (refCookie) {
    res.cookies.set({
      name: 'sv_ref',
      value: encodeURIComponent(JSON.stringify(refCookie)),
      httpOnly: true,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  const affCookie = buildAffCookie(req);
  if (affCookie) {
    res.cookies.set({
      name: 'sv_aff',
      value: encodeURIComponent(JSON.stringify(affCookie)),
      httpOnly: true,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|robots.txt|sitemap.xml|manifest.json|api/).*)',
  ],
};
