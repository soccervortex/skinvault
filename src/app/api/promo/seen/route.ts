import { NextResponse } from 'next/server';
import { markPromoSeen } from '@/app/utils/promo-storage';
import { ThemeType } from '@/app/utils/theme-storage';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { theme, steamId, anonId } = body as { theme: ThemeType; steamId?: string; anonId?: string };

    if (!theme) {
      return NextResponse.json({ error: 'theme required' }, { status: 400 });
    }

    await markPromoSeen(theme, steamId || null, anonId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark promo as seen:', error);
    return NextResponse.json({ error: 'Failed to update promo status' }, { status: 500 });
  }
}

