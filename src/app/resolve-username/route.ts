import { NextResponse } from 'next/server';
import { GET as resolveSteam } from '@/app/api/steam/resolve-username/route';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('query') || url.searchParams.get('username') || url.searchParams.get('q') || '';
  const query = String(q || '').trim();
  if (!query) return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });

  const forwardUrl = new URL(request.url);
  forwardUrl.pathname = '/api/steam/resolve-username';
  forwardUrl.search = '';
  forwardUrl.searchParams.set('query', query);

  const forwarded = new Request(forwardUrl.toString(), {
    method: 'GET',
    headers: request.headers,
  });

  return resolveSteam(forwarded);
}
