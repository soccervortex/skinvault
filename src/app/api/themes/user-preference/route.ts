import { NextResponse } from 'next/server';
import { setUserThemePreference, hasUserDisabledThemes } from '@/app/utils/theme-storage';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { steamId, disabled } = body as { steamId: string; disabled: boolean };

    if (!steamId || typeof disabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await setUserThemePreference(steamId, disabled);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update user theme preference:', error);
    return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'steamId required' }, { status: 400 });
    }

    const disabled = await hasUserDisabledThemes(steamId);
    return NextResponse.json({ disabled });
  } catch (error) {
    console.error('Failed to get user theme preference:', error);
    return NextResponse.json({ error: 'Failed to get preference' }, { status: 500 });
  }
}

