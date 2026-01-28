import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { dbGet, dbSet } from '@/app/utils/database';
import { notifyUserBan, notifyUserUnban } from '@/app/utils/discord-webhook';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

import { getAdminSteamId, isOwnerRequest } from '@/app/utils/admin-auth';

const BANNED_KEY = 'banned_steam_ids';
const BAN_REASONS_KEY = 'ban_reasons';

export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSteamId = getAdminSteamId(request);

    // Check if user is owner
    const url = new URL(request.url);
    const steamIdParam = url.searchParams.get('steamId');
    
    // Also check from request body
    const body = await request.json().catch(() => null);
    const bodySteamId = body?.steamId;
    
    const rawSteamId = bodySteamId || steamIdParam;
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    const reason = String(body?.reason || '').trim();
    const bySteamId = adminSteamId;

    // Store banned Steam IDs (uses database abstraction - KV + MongoDB)
    try {
      const banned = await dbGet<string[]>(BANNED_KEY) || [];
      if (!banned.includes(steamId)) {
        banned.push(steamId);
        await dbSet(BANNED_KEY, banned);
        
        // Send Discord notification for user ban
        notifyUserBan(steamId, adminSteamId || undefined).catch(error => {
          console.error('Failed to send ban notification:', error);
        });

        try {
          if (hasMongoConfig()) {
            const db = await getDatabase();
            await createUserNotification(
              db,
              steamId,
              'user_banned',
              'You have been banned',
              reason ? `You have been banned from SkinVaults. Reason: ${reason}` : 'You have been banned from SkinVaults.',
              { bySteamId, reason: reason || null }
            );
          }
        } catch {
        }
      }

      if (reason) {
        try {
          const reasons = (await dbGet<Record<string, any>>(BAN_REASONS_KEY, false)) || {};
          const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
          next[steamId] = {
            reason,
            at: new Date().toISOString(),
            by: adminSteamId,
          };
          await dbSet(BAN_REASONS_KEY, next);
        } catch {
        }
      }
      return NextResponse.json({ steamId, banned: true });
    } catch (error) {
      console.error('Failed to ban Steam ID:', error);
      return NextResponse.json({ error: 'Failed to ban Steam ID' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to ban Steam ID:', error);
    return NextResponse.json({ error: 'Failed to ban Steam ID' }, { status: 500 });
  }
}

// GET: Check if Steam ID is banned
export async function GET(request: NextRequest) {
  if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(request.url);
    const rawSteamId = url.searchParams.get('steamId');
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    try {
      const banned = await dbGet<string[]>(BANNED_KEY) || [];
      return NextResponse.json({ steamId, banned: banned.includes(steamId) });
    } catch (error) {
      console.error('Failed to check ban status:', error);
      return NextResponse.json({ steamId, banned: false });
    }
  } catch (error) {
    console.error('Failed to check ban status:', error);
    return NextResponse.json({ error: 'Failed to check ban status' }, { status: 500 });
  }
}

// DELETE: Unban a Steam ID
export async function DELETE(request: NextRequest) {
  if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const adminSteamId = getAdminSteamId(request);
    const url = new URL(request.url);
    const rawSteamId = url.searchParams.get('steamId');
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    try {
      const banned = await dbGet<string[]>(BANNED_KEY) || [];
      const wasBanned = banned.includes(steamId);
      const updatedBanned = banned.filter(id => id !== steamId);
      await dbSet(BANNED_KEY, updatedBanned);

      try {
        const reasons = (await dbGet<Record<string, any>>(BAN_REASONS_KEY, false)) || {};
        const next: Record<string, any> = typeof reasons === 'object' && reasons ? { ...reasons } : {};
        delete next[steamId];
        await dbSet(BAN_REASONS_KEY, next);
      } catch {
      }
      
      // Send Discord notification for user unban
      if (wasBanned) {
        notifyUserUnban(steamId, adminSteamId || undefined).catch(error => {
          console.error('Failed to send unban notification:', error);
        });

        try {
          if (hasMongoConfig()) {
            const db = await getDatabase();
            const bySteamId = adminSteamId;
            await createUserNotification(
              db,
              steamId,
              'user_unbanned',
              'You have been unbanned',
              'Your account ban has been lifted. You can now access SkinVaults again.',
              { bySteamId }
            );
          }
        } catch {
        }
      }
      
      return NextResponse.json({ steamId, banned: false, message: 'User has been unbanned' });
    } catch (error) {
      console.error('Failed to unban Steam ID:', error);
      return NextResponse.json({ error: 'Failed to unban Steam ID' }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to unban Steam ID:', error);
    return NextResponse.json({ error: 'Failed to unban Steam ID' }, { status: 500 });
  }
}

