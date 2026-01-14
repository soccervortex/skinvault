import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

const ADMIN_HEADER = 'x-admin-key';

export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { steamId, rewardType, quantity = 1 } = await request.json();

    if (!steamId || !rewardType) {
      return NextResponse.json({ error: 'Missing steamId or rewardType' }, { status: 400 });
    }

    const rewardsKey = 'user_rewards';
    const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
    const userRewards = existingRewards[steamId] || [];

    // Check if already has this reward
    const hasReward = userRewards.some((r: any) => r?.type === rewardType);
    
    if (!hasReward) {
      // Add reward
      for (let i = 0; i < quantity; i++) {
        userRewards.push({
          type: rewardType,
          grantedAt: new Date().toISOString(),
          source: 'admin_manual',
        });
      }

      existingRewards[steamId] = userRewards;
      await dbSet(rewardsKey, existingRewards);

      try {
        if (hasMongoConfig()) {
          const db = await getDatabase();
          await createUserNotification(
            db,
            String(steamId),
            'reward_granted',
            'Reward Granted',
            `A staff member granted you a reward: ${String(rewardType)} (x${Number(quantity) || 1}).`,
            { rewardType, quantity: Number(quantity) || 1 }
          );
        }
      } catch {
      }

      return NextResponse.json({ 
        success: true, 
        message: `Granted ${quantity} ${rewardType} to ${steamId}`,
        steamId,
        rewardType,
        quantity,
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        message: `User already has ${rewardType}`,
        steamId,
        rewardType,
        alreadyHas: true,
      });
    }
  } catch (error: any) {
    console.error('Failed to grant reward:', error);
    return NextResponse.json({ error: error.message || 'Failed to grant reward' }, { status: 500 });
  }
}

// GET: Check if user has a specific reward
export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');
    const rewardType = searchParams.get('rewardType');

    if (!steamId || !rewardType) {
      return NextResponse.json({ error: 'Missing steamId or rewardType' }, { status: 400 });
    }

    const rewardsKey = 'user_rewards';
    const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
    const userRewards = existingRewards[steamId] || [];

    const hasReward = userRewards.some((r: any) => r?.type === rewardType);
    const count = userRewards.filter((r: any) => r?.type === rewardType).length;

    return NextResponse.json({ 
      hasReward,
      count,
      steamId,
      rewardType,
      allRewards: userRewards,
    });
  } catch (error: any) {
    console.error('Failed to check reward:', error);
    return NextResponse.json({ error: error.message || 'Failed to check reward' }, { status: 500 });
  }
}

