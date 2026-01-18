import { NextResponse } from 'next/server';

const ADMIN_API_TOKEN = process.env.DISCORD_BOT_API_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || 'https://www.skinvaults.online';

export async function POST(request: Request) {
  const authToken = request.headers.get('Authorization');
  if (!ADMIN_API_TOKEN || authToken !== `Bearer ${ADMIN_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, steamId, reason, duration, actingAdminSteamId } = body;

  if (!action || !steamId) {
    return NextResponse.json({ error: 'Missing action or steamId' }, { status: 400 });
  }

  try {
    if (action === 'ban') {
      const banApiUrl = `${API_BASE_URL}/api/admin/ban`;
      const response = await fetch(banApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.ADMIN_PRO_TOKEN || '',
        },
        body: JSON.stringify({ steamId, reason, adminSteamId: actingAdminSteamId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to ban user on website');
      }

      return NextResponse.json({ success: true, message: `User ${steamId} has been banned on the website.` });

    } else if (action === 'unban') {
        const unbanApiUrl = `${API_BASE_URL}/api/admin/ban`;
        const response = await fetch(unbanApiUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-key': process.env.ADMIN_PRO_TOKEN || '',
            },
            body: JSON.stringify({ steamId, adminSteamId: actingAdminSteamId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to unban user on website');
        }

        return NextResponse.json({ success: true, message: `User ${steamId} has been unbanned on the website.` });

    } else if (action === 'timeout') {
      if (!duration) {
        return NextResponse.json({ error: 'Timeout duration is required' }, { status: 400 });
      }
      const timeoutApiUrl = `${API_BASE_URL}/api/chat/timeout`;
      const response = await fetch(timeoutApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.ADMIN_PRO_TOKEN || '',
        },
        body: JSON.stringify({ steamId, reason, minutes: duration, adminSteamId: actingAdminSteamId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to timeout user on website');
      }

      return NextResponse.json({ success: true, message: `User ${steamId} has been timed out on the website for ${duration} minutes.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error(`[Discord Moderation API] Failed to execute '${action}' for ${steamId}:`, error);
    return NextResponse.json({ error: error.message || 'An internal error occurred' }, { status: 500 });
  }
}