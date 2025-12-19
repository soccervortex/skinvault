import { NextResponse } from 'next/server';
import { fetchWithProxyRotation } from '@/app/utils/proxy-utils';

// Proxy endpoint for fetching Steam market prices
// Supports both direct URL and market_hash_name parameters
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamUrl = url.searchParams.get('url');
    const marketHashName = url.searchParams.get('market_hash_name');
    const currency = url.searchParams.get('currency') || '3';

    // If market_hash_name is provided, build the Steam URL
    if (marketHashName && !steamUrl) {
      const builtUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency}&market_hash_name=${encodeURIComponent(marketHashName)}`;
      
      // Use proxy rotation to fetch price
      try {
        const data = await fetchWithProxyRotation(builtUrl, true, {
          parallel: false,
          marketHashName,
          currency,
        });
        
        if (data && (data.success || data.lowest_price || data.median_price)) {
          return NextResponse.json({
            success: true,
            ...data,
          });
        }
      } catch (error) {
        console.error('Price fetch via proxy failed:', error);
      }
    }

    // Fallback to direct URL if provided
    if (!steamUrl) {
      return NextResponse.json({ error: 'Missing url or market_hash_name parameter' }, { status: 400 });
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

