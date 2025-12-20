import { NextResponse } from 'next/server';
import { hasUserClaimedGift, saveUserGiftClaim, getUserGiftReward } from '@/app/utils/gift-storage';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { steamId, reward } = body as { steamId: string; reward: any };

    if (!steamId || !reward) {
      return NextResponse.json({ error: 'Missing steamId or reward' }, { status: 400 });
    }

    // Check if user already claimed
    const alreadyClaimed = await hasUserClaimedGift(steamId);
    if (alreadyClaimed) {
      return NextResponse.json({ 
        error: 'You have already claimed your gift this year',
        alreadyClaimed: true 
      }, { status: 400 });
    }

    // Save claim
    await saveUserGiftClaim(steamId, reward);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to claim gift:', error);
    return NextResponse.json({ error: 'Failed to claim gift' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'steamId required' }, { status: 400 });
    }

    const claimed = await hasUserClaimedGift(steamId);
    const reward = claimed ? await getUserGiftReward(steamId) : null;
    
    return NextResponse.json({ claimed, reward });
  } catch (error) {
    console.error('Failed to check gift claim:', error);
    return NextResponse.json({ error: 'Failed to check claim' }, { status: 500 });
  }
}

