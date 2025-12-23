import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { isOwner } from '@/app/utils/owner-ids';

const TIMEOUT_USERS_KEY = 'timeout_users';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminSteamId = searchParams.get('adminSteamId');

    // Verify admin
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const timeoutUsers = await dbGet<Record<string, string>>(TIMEOUT_USERS_KEY) || {};
    const now = new Date();

    const timeouts = Object.entries(timeoutUsers)
      .map(([steamId, timeoutUntil]) => {
        const timeoutDate = new Date(timeoutUntil);
        const isActive = timeoutDate > now;
        const minutesRemaining = isActive 
          ? Math.ceil((timeoutDate.getTime() - now.getTime()) / (1000 * 60))
          : 0;

        return {
          steamId,
          timeoutUntil,
          isActive,
          minutesRemaining,
        };
      })
      .filter(timeout => timeout.isActive)
      .sort((a, b) => new Date(a.timeoutUntil).getTime() - new Date(b.timeoutUntil).getTime());

    return NextResponse.json({ timeouts });
  } catch (error) {
    console.error('Failed to get timeouts:', error);
    return NextResponse.json({ error: 'Failed to get timeouts' }, { status: 500 });
  }
}

