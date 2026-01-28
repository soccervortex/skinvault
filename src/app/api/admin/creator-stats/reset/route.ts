import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import type { NextRequest } from 'next/server';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'creator_stats')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const slugRaw = searchParams.get('slug');
    const slug = slugRaw ? String(slugRaw).toLowerCase().trim() : null;

    const body = await request.json().catch(() => null);
    const dryRun = Boolean(body?.dryRun);

    const db = await getDatabase();
    const events = db.collection('analytics_events');

    const filter: any = {};
    if (slug) filter.refSlug = slug;

    if (dryRun) {
      const count = await events.countDocuments(filter);
      return NextResponse.json({ ok: true, dryRun: true, slug, match: count });
    }

    const result = await events.deleteMany(filter);
    return NextResponse.json({ ok: true, dryRun: false, slug, deleted: result.deletedCount || 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to reset stats' }, { status: 500 });
  }
}
