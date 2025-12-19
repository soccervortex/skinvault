import { NextResponse } from 'next/server';

// Server-side Steam price API for Pro users (direct access, no proxies)
// This provides faster, live prices for Pro subscribers
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamUrl = url.searchParams.get('url');
    
    if (!steamUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Direct fetch to Steam API (server-side, no CORS issues)
    const response = await fetch(steamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      cache: 'no-store', // Always get fresh data for Pro users
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Steam API request failed' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Steam price API error:', error);
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}

