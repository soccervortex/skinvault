import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { createUserNotification } from '@/app/utils/user-notifications';

export const runtime = 'nodejs';

function uniqValidSteamIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!/^\d{17}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function getAllKnownSteamIds(db: any, maxUsers: number): Promise<string[]> {
  const results: string[] = [];
  const seen = new Set<string>();

  const addMany = (arr: any[]) => {
    for (const v of arr) {
      const id = String(v || '').trim();
      if (!/^\d{17}$/.test(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      results.push(id);
      if (results.length >= maxUsers) break;
    }
  };

  const tryDistinct = async (collectionName: string, field: string) => {
    if (results.length >= maxUsers) return;
    try {
      const col = db.collection(collectionName);
      const rows: any[] = await col.distinct(field, {});
      addMany(rows);
    } catch {
      // ignore
    }
  };

  await tryDistinct('user_credits', '_id');
  await tryDistinct('user_settings', '_id');
  await tryDistinct('creator_attribution', 'steamId');

  await tryDistinct('giveaway_entries', 'steamId');

  await tryDistinct('affiliate_referrals', 'referrerSteamId');
  await tryDistinct('affiliate_referrals', 'referredSteamId');
  await tryDistinct('affiliate_milestone_claims', 'steamId');

  await tryDistinct('user_notifications', 'steamId');

  return results.slice(0, maxUsers);
}

export async function POST(req: NextRequest) {
  const requesterSteamId = getSteamIdFromRequest(req);
  if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const target = String(body?.target || '').trim();

    const type = String(body?.type || 'info').trim() || 'info';
    const title = String(body?.title || '').trim();
    const message = String(body?.message || '').trim();
    const meta = body?.meta ?? null;

    if (!title) return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

    const db = await getDatabase();

    if (target === 'all') {
      const rawMax = Number(body?.maxUsers || 5000);
      const maxUsers = Math.min(5000, Math.max(1, Math.floor(Number.isFinite(rawMax) ? rawMax : 5000)));
      const steamIds = await getAllKnownSteamIds(db, maxUsers);
      const ids = uniqValidSteamIds(steamIds);

      for (const sid of ids) {
        await createUserNotification(db, sid, type, title, message, { ...(meta || {}), bySteamId: requesterSteamId, scope: 'broadcast' });
      }

      return NextResponse.json({ ok: true, sent: ids.length }, { status: 200 });
    }

    const targetSteamId = sanitizeSteamId(body?.steamId) || sanitizeSteamId(target);
    if (!targetSteamId) return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });

    await createUserNotification(db, targetSteamId, type, title, message, { ...(meta || {}), bySteamId: requesterSteamId, scope: 'direct' });

    return NextResponse.json({ ok: true, sent: 1, steamId: targetSteamId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send notification' }, { status: 500 });
  }
}
