import { NextResponse } from 'next/server';

// Proxy endpoint for fetching Steam market prices directly (Pro users)
// This bypasses CORS and allows direct access to Steam API
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamUrl = url.searchParams.get('url');

    if (!steamUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Fetch from Steam API
    const response = await fetch(steamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Steam API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('Steam price fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Steam price' },
      { status: 500 }
    );
  }
}

