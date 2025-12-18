import { NextResponse } from 'next/server';
import { getAllProUsers } from '@/app/utils/pro-storage';

export async function GET() {
  try {
    const data = await getAllProUsers();
    const now = new Date();

    const entries = Object.entries(data).map(([steamId, proUntil]) => {
      const expiry = new Date(proUntil);
      const isActive = expiry > now;
      const daysRemaining = Math.max(
        0,
        Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      return {
        steamId,
        proUntil,
        isActive,
        daysRemaining,
      };
    });

    const total = entries.length;
    const active = entries.filter((e) => e.isActive).length;
    const expired = total - active;

    return NextResponse.json({
      total,
      active,
      expired,
      entries,
    });
  } catch (error) {
    console.error('Failed to get Pro stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

