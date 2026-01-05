import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#0f111a"/></svg>';
  
  return new Response(FALLBACK_SVG, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=600',
    },
  });
}
