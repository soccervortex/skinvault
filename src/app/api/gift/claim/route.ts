import { NextResponse } from 'next/server';
import { hasUserClaimedGift, saveUserGiftClaim, getUserGiftReward } from '@/app/utils/gift-storage';
import { getRandomReward } from '@/app/utils/theme-rewards';
import { getProUntil, grantPro } from '@/app/utils/pro-storage';
import { ThemeType } from '@/app/utils/theme-storage';
import { notifyNewProUser } from '@/app/utils/discord-webhook';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

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
    const isPro = !!(proUntil && new Date(proUntil) > new Date());
    
    // Get random reward based on Pro status and theme
    const reward = getRandomReward(theme, isPro);

    // If Pro extension reward, apply it immediately
    if (reward.type === 'pro_extension' && reward.value) {
      const months = reward.value;
      const proUntil = await grantPro(steamId, months);
      
      // Send Discord notification for Pro granted via gift
      notifyNewProUser(steamId, months, proUntil, 'gift_claim').catch(error => {
        console.error('Failed to send gift Pro notification:', error);
      });
    }

    // Save claim
    await saveUserGiftClaim(steamId, reward, theme);

    try {
      if (hasMongoConfig()) {
        const db = await getDatabase();
        const rewardType = String((reward as any)?.type || '').trim() || 'reward';
        await createUserNotification(
          db,
          steamId,
          'gift_claimed',
          'Gift Claimed',
          `You claimed your gift reward: ${rewardType}.`,
          { theme, reward }
        );
      }
    } catch {
    }

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
