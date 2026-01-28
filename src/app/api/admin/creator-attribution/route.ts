import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import type { NextRequest } from 'next/server';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

function isValidSlug(input: string | null): boolean {
  const s = String(input || '').trim().toLowerCase();
  return Boolean(s) && /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'creator_users')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const steamId = sanitizeSteamId(body?.steamId) || null;
    const slug = String(body?.slug || '').trim().toLowerCase();
    const mode = String(body?.mode || 'set'); // set | remove
    const purgeEvents = Boolean(body?.purgeEvents);
    const backfillEvents = Boolean(body?.backfillEvents);

    if (!steamId) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }
    if (mode !== 'set' && mode !== 'remove') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    const db = await getDatabase();
    const attributions = db.collection('creator_attribution');

    if (mode === 'set') {
      const now = new Date();
      await attributions.updateOne(
        { steamId },
        {
          $set: {
            steamId,
            refSlug: slug,
            utm: { manual: true },
            lastSeenAt: now,
          },
          $setOnInsert: {
            firstSeenAt: now,
          },
        },
        { upsert: true }
      );

      let backfilledEvents = 0;
      if (backfillEvents) {
        const events = db.collection('analytics_events');
        const result = await events.updateMany(
          {
            steamId,
            $or: [{ refSlug: null }, { refSlug: { $exists: false } }],
          },
          { $set: { refSlug: slug } }
        );
        backfilledEvents = (result as any)?.modifiedCount || 0;
      }

      return NextResponse.json({ ok: true, mode, steamId, slug, backfilledEvents });
    }

    // mode === 'remove'
    const existing = await attributions.findOne({ steamId });
    if (!existing) {
      return NextResponse.json({ ok: true, mode, steamId, slug, removed: false, purgedEvents: 0 });
    }

    // Only remove if the current refSlug matches what was requested
    const currentSlug = existing?.refSlug ? String(existing.refSlug).toLowerCase() : null;
    if (currentSlug !== slug) {
      return NextResponse.json({
        ok: false,
        error: `SteamID is not attributed to ${slug} (currently ${currentSlug || 'none'})`,
      }, { status: 409 });
    }

    await attributions.deleteOne({ steamId });

    let purgedEvents = 0;
    if (purgeEvents) {
      const events = db.collection('analytics_events');
      const result = await events.deleteMany({ steamId, refSlug: slug });
      purgedEvents = result.deletedCount || 0;
    }

    return NextResponse.json({ ok: true, mode, steamId, slug, removed: true, purgedEvents });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update creator attribution' }, { status: 500 });
  }
}
