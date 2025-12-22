import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const ADMIN_HEADER = 'x-admin-key';

export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Check purchase history
    const purchasesKey = 'purchase_history';
    const purchases = await kv.get<Array<any>>(purchasesKey) || [];
    const userPurchases = purchases.filter(p => p.steamId === steamId);

    // Check user_rewards
    const rewardsKey = 'user_rewards';
    const existingRewards = await kv.get<Record<string, any[]>>(rewardsKey) || {};
    const userRewards = existingRewards[steamId] || [];

    // Check for discord_access specifically
    const hasDiscordAccess = userRewards.some((r: any) => r?.type === 'discord_access');

    return NextResponse.json({
      steamId,
      hasDiscordAccess,
      rewardCount: userRewards.length,
      allRewards: userRewards,
      purchases: userPurchases,
      discordAccessPurchases: userPurchases.filter(p => p.consumableType === 'discord_access'),
    });
  } catch (error: any) {
    console.error('Failed to check rewards:', error);
    return NextResponse.json({ error: error.message || 'Failed to check rewards' }, { status: 500 });
  }
}

