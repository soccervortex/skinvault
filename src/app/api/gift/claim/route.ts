import { NextResponse } from 'next/server';
import { hasUserClaimedGift, saveUserGiftClaim, getUserGiftReward } from '@/app/utils/gift-storage';
import { getRandomReward } from '@/app/utils/theme-rewards';
import { getProUntil, grantPro } from '@/app/utils/pro-storage';
import { ThemeType } from '@/app/utils/theme-storage';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { steamId, theme } = body as { steamId: string; theme: ThemeType };

    if (!steamId || !theme) {
      return NextResponse.json({ error: 'Missing steamId or theme' }, { status: 400 });
    }

    // Check if user already claimed for this theme
    const alreadyClaimed = await hasUserClaimedGift(steamId, theme);
    if (alreadyClaimed) {
      return NextResponse.json({ 
        error: 'You have already claimed your gift for this event',
        alreadyClaimed: true 
      }, { status: 400 });
    }

    // Check if user is Pro to determine reward pool
    const proUntil = await getProUntil(steamId);
    const isPro = proUntil && new Date(proUntil) > new Date();
    
    // Get random reward based on Pro status and theme
    const reward = getRandomReward(theme, isPro);

    // If Pro extension reward, apply it immediately
    if (reward.type === 'pro_extension' && reward.value) {
      const months = reward.value;
      await grantPro(steamId, months);
    }

    // Save claim
    await saveUserGiftClaim(steamId, reward, theme);

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error('Failed to claim gift:', error);
    return NextResponse.json({ error: 'Failed to claim gift' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');
    const theme = searchParams.get('theme') as ThemeType;

    if (!steamId || !theme) {
      return NextResponse.json({ error: 'steamId and theme required' }, { status: 400 });
    }

    const claimed = await hasUserClaimedGift(steamId, theme);
    const reward = claimed ? await getUserGiftReward(steamId, theme) : null;
    
    return NextResponse.json({ claimed, reward });
  } catch (error) {
    console.error('Failed to check gift claim:', error);
    return NextResponse.json({ error: 'Failed to check claim' }, { status: 500 });
  }
}
