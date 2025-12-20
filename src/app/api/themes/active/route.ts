import { NextResponse } from 'next/server';
import { getActiveTheme } from '@/app/utils/theme-storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    const activeTheme = await getActiveTheme(steamId || null);
    return NextResponse.json({ theme: activeTheme });
  } catch (error) {
    console.error('Failed to get active theme:', error);
    return NextResponse.json({ error: 'Failed to get active theme' }, { status: 500 });
  }
}

