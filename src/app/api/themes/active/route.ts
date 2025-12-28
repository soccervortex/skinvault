import { NextResponse } from 'next/server';
import { getActiveTheme } from '@/app/utils/theme-storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');
    
    // Check for cache-busting parameter (when theme was just changed)
    const noCache = searchParams.get('nocache') === 'true';
    
    // Force fresh read by bypassing cache if requested
    const activeTheme = await getActiveTheme(steamId || null);
    
    // Set cache control headers to prevent browser caching
    return NextResponse.json(
      { theme: activeTheme },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Failed to get active theme:', error);
    return NextResponse.json({ error: 'Failed to get active theme' }, { status: 500 });
  }
}

