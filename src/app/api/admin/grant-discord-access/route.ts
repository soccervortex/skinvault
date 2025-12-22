import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';

export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { steamId } = await request.json();

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    const rewardsKey = 'user_rewards';
    const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
    const userRewards = existingRewards[steamId] || [];

    // Check if already has discord_access
    const hasAccess = userRewards.some((r: any) => r?.type === 'discord_access');
    
    if (!hasAccess) {
      // Grant discord_access
      userRewards.push({
        type: 'discord_access',
        grantedAt: new Date().toISOString(),
        source: 'admin_manual',
      });

      existingRewards[steamId] = userRewards;
      await dbSet(rewardsKey, existingRewards);

      return NextResponse.json({ 
        success: true, 
        message: `Granted Discord access to ${steamId}`,
        steamId,
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        message: `User already has Discord access`,
        steamId,
        alreadyHas: true,
      });
    }
  } catch (error: any) {
    console.error('Failed to grant Discord access:', error);
    return NextResponse.json({ error: error.message || 'Failed to grant Discord access' }, { status: 500 });
  }
}

