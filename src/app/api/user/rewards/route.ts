import { NextResponse } from 'next/server';
import { getUserGiftReward } from '@/app/utils/gift-storage';
import type { ThemeType } from '@/app/utils/theme-storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Get all rewards from all themes
    const themes: ThemeType[] = ['christmas', 'halloween', 'easter', 'sinterklaas', 'newyear', 'oldyear'];
    const rewards: Array<{ theme: ThemeType; reward: any }> = [];

    for (const theme of themes) {
      const reward = await getUserGiftReward(steamId, theme);
      if (reward) {
        rewards.push({ theme, reward });
      }
    }

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error('Failed to get user rewards:', error);
    return NextResponse.json({ error: 'Failed to get rewards' }, { status: 500 });
  }
}

