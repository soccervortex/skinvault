import { NextResponse } from 'next/server';
import { recordFirstLogin } from '@/app/utils/pro-storage';

// Record first login date when user logs in via Steam
export async function POST(request: Request) {
  try {
    const { steamId } = await request.json();

    if (!steamId || typeof steamId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid steamId' }, { status: 400 });
    }

    // Validate Steam ID format (should be numeric, 17 digits)
    if (!/^\d{17}$/.test(steamId)) {
      console.warn('Invalid Steam ID format:', steamId);
      return NextResponse.json({ error: 'Invalid Steam ID format' }, { status: 400 });
    }

    // Record first login (only records if not already recorded)
    await recordFirstLogin(steamId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record first login:', error);
    return NextResponse.json({ error: 'Failed to record first login' }, { status: 500 });
  }
}
