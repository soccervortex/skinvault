import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { grantPro, getProUntil, getAllProUsers } from '@/app/utils/pro-storage';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { notifyNewProUser } from '@/app/utils/discord-webhook';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';
import { isOwnerRequest } from '@/app/utils/admin-auth';

export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawSteamId = body?.steamId as string | undefined;
    const months = Number(body?.months ?? 0);
    const grantedBy = body?.grantedBy as string | undefined; // Optional: who granted it

    // Sanitize and validate SteamID
    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    // Validate months
    if (!months || months <= 0 || months > 120) {
      return NextResponse.json({ error: 'Invalid months value (must be between 1 and 120)' }, { status: 400 });
    }

    const proUntil = await grantPro(steamId, months);
    
    // Send Discord notification for new Pro user
    notifyNewProUser(steamId, months, proUntil, grantedBy).catch(error => {
      console.error('Failed to send Pro user notification:', error);
    });

    try {
      if (hasMongoConfig()) {
        const db = await getDatabase();
        const byRaw = String(grantedBy || '').trim();
        const bySteamId = /^\d{17}$/.test(byRaw) ? byRaw : null;
        await createUserNotification(
          db,
          steamId,
          'pro_granted',
          'Pro Activated',
          `Your Pro status was updated. Added ${months} month${months === 1 ? '' : 's'}.`,
          { bySteamId, months, proUntil }
        );
      }
    } catch {
    }
    
    return NextResponse.json({ steamId, proUntil });
  } catch (error) {
    console.error('Failed to grant Pro:', error);
    return NextResponse.json({ error: 'Failed to grant Pro' }, { status: 500 });
  }
}

// DELETE: Remove Pro status
export async function DELETE(request: Request) {
  try {
    if (!isOwnerRequest(request as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const rawSteamId = url.searchParams.get('steamId');

    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    // Remove Pro by setting expiry to yesterday (more reasonable than 2000)
    const { dbGet, dbSet } = await import('@/app/utils/database');
    const PRO_USERS_KEY = 'pro_users';
    
    try {
      const data = await dbGet<Record<string, string>>(PRO_USERS_KEY) || {};
      // Set to yesterday to mark as expired (more reasonable than 2000-01-01)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      data[steamId] = yesterday.toISOString();
      await dbSet(PRO_USERS_KEY, data);

      try {
        if (hasMongoConfig()) {
          const db = await getDatabase();
          const byRaw = String(url.searchParams.get('removedBy') || url.searchParams.get('deletedBy') || '').trim();
          const bySteamId = /^\d{17}$/.test(byRaw) ? byRaw : null;
          await createUserNotification(
            db,
            steamId,
            'pro_removed',
            'Pro Removed',
            'Your Pro status was removed by staff.',
            { bySteamId }
          );
        }
      } catch {
      }
    } catch (error) {
      console.error('Failed to delete Pro:', error);
      return NextResponse.json({ error: 'Failed to delete Pro' }, { status: 500 });
    }

    return NextResponse.json({ steamId, deleted: true });
  } catch (error) {
    console.error('Failed to delete Pro:', error);
    return NextResponse.json({ error: 'Failed to delete Pro' }, { status: 500 });
  }
}

// PATCH: Edit Pro status (set specific expiry date)
export async function PATCH(request: Request) {
  try {
    if (!isOwnerRequest(request as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawSteamId = body?.steamId as string | undefined;
    const proUntil = body?.proUntil as string | undefined;

    const steamId = rawSteamId ? sanitizeSteamId(rawSteamId) : null;
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid SteamID format' }, { status: 400 });
    }

    if (!proUntil) {
      return NextResponse.json({ error: 'Missing proUntil date' }, { status: 400 });
    }

    // Validate date
    const expiryDate = new Date(proUntil);
    if (isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const { dbGet, dbSet } = await import('@/app/utils/database');
    const PRO_USERS_KEY = 'pro_users';
    
    try {
      const data = await dbGet<Record<string, string>>(PRO_USERS_KEY) || {};
      data[steamId] = expiryDate.toISOString();
      await dbSet(PRO_USERS_KEY, data);

      try {
        if (hasMongoConfig()) {
          const db = await getDatabase();
          const byRaw = String(body?.editedBy || '').trim();
          const bySteamId = /^\d{17}$/.test(byRaw) ? byRaw : null;
          await createUserNotification(
            db,
            steamId,
            'pro_updated',
            'Pro Status Updated',
            `Your Pro status expiry was updated to ${expiryDate.toISOString()}.`,
            { bySteamId, proUntil: expiryDate.toISOString() }
          );
        }
      } catch {
      }
    } catch (error) {
      console.error('Failed to edit Pro:', error);
      return NextResponse.json({ error: 'Failed to edit Pro' }, { status: 500 });
    }

    return NextResponse.json({ steamId, proUntil: expiryDate.toISOString() });
  } catch (error) {
    console.error('Failed to edit Pro:', error);
    return NextResponse.json({ error: 'Failed to edit Pro' }, { status: 500 });
  }
}

