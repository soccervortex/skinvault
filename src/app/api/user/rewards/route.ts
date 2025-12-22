import { NextResponse } from 'next/server';
import { getUserGiftReward } from '@/app/utils/gift-storage';
import type { ThemeType } from '@/app/utils/theme-storage';
import { dbGet } from '@/app/utils/database';

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

    // Also get purchased consumables from user_rewards (database abstraction)
    try {
      const rewardsKey = 'user_rewards';
      const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
      const userRewards = existingRewards[steamId] || [];
      
      // Add consumable rewards as theme-less rewards
      userRewards.forEach((consumableReward) => {
        rewards.push({
          theme: 'christmas' as ThemeType, // Use a placeholder theme (consumables don't need theme)
          reward: consumableReward,
        });
      });
    } catch (error) {
      console.error('Failed to get consumable rewards:', error);
      // Continue without consumables if database fails
    }

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error('Failed to get user rewards:', error);
    return NextResponse.json({ error: 'Failed to get rewards' }, { status: 500 });
  }
}

