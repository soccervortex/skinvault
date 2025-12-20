import { NextResponse } from 'next/server';
import { getPromoStatus, shouldShowPromo } from '@/app/utils/promo-storage';
import { ThemeType } from '@/app/utils/theme-storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const theme = searchParams.get('theme') as ThemeType;
    const steamId = searchParams.get('steamId');
    const anonId = searchParams.get('anonId');

    if (!theme) {
      return NextResponse.json({ error: 'theme required' }, { status: 400 });
    }

    const status = await getPromoStatus(theme, steamId || null, anonId || undefined);
    const shouldShow = await shouldShowPromo(theme, steamId || null, anonId || undefined);

    return NextResponse.json({ status, shouldShow });
  } catch (error) {
    console.error('Failed to get promo status:', error);
    return NextResponse.json({ error: 'Failed to get promo status' }, { status: 500 });
  }
}

