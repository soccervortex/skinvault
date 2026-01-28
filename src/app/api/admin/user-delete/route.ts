import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const steamId = sanitizeSteamId(body?.steamId);
    if (!steamId) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    const dryRun = Boolean(body?.dryRun);
    const deleteAttribution = body?.deleteAttribution !== false;
    const deleteAnalytics = Boolean(body?.deleteAnalytics);

    const db = await getDatabase();
    const attributions = db.collection('creator_attribution');
    const events = db.collection('analytics_events');

    const out: any = {
      ok: true,
      steamId,
      dryRun,
      deleteAttribution,
      deleteAnalytics,
      counts: {
        attributionDocs: 0,
        analyticsEvents: 0,
      },
    };

    if (deleteAttribution) {
      out.counts.attributionDocs = await attributions.countDocuments({ steamId });
    }
    if (deleteAnalytics) {
      out.counts.analyticsEvents = await events.countDocuments({ steamId });
    }

    if (dryRun) {
      return NextResponse.json(out);
    }

    if (deleteAttribution) {
      const r = await attributions.deleteMany({ steamId });
      out.deletedAttribution = r.deletedCount || 0;
    }

    if (deleteAnalytics) {
      const r = await events.deleteMany({ steamId });
      out.deletedAnalytics = r.deletedCount || 0;
    }

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete user data' }, { status: 500 });
  }
}
