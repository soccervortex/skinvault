import { NextResponse } from 'next/server';
import { getActiveTheme } from '@/app/utils/theme-storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');
    
    // ALWAYS bypass cache to get fresh theme data
    const activeTheme = await getActiveTheme(steamId || null, true);
    
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

