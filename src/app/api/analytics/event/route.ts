import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';

type IncomingEvent = {
  event: string;
  path?: string;
  steamId?: string;
  title?: string;
  value?: number;
  metadata?: Record<string, any>;
};

function safeString(v: unknown, max = 200): string {
  const s = String(v ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

function parseJsonCookie(v?: string | null): any | null {
  if (!v) return null;
  try {
    return JSON.parse(decodeURIComponent(v));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as IncomingEvent | null;
    if (!body?.event) {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 });
    }

    const event = safeString(body.event, 64);
    const path = safeString(body.path, 500);
    const title = safeString(body.title, 200);
    const steamIdRaw = safeString(body.steamId, 32);
    const steamId = /^\d{17}$/.test(steamIdRaw) ? steamIdRaw : null;

    const sid = safeString(req.cookies.get('sv_sid')?.value, 80) || null;
    const refCookie = parseJsonCookie(req.cookies.get('sv_ref')?.value);

    const db = await getDatabase();
    const attributions = db.collection('creator_attribution');

    let refSlug: string | null = null;
    let utm: any | null = null;

    if (refCookie?.ref) {
      refSlug = safeString(refCookie.ref, 80).toLowerCase();
      utm = {
        utm_source: safeString(refCookie.utm_source, 120) || undefined,
        utm_medium: safeString(refCookie.utm_medium, 120) || undefined,
        utm_campaign: safeString(refCookie.utm_campaign, 120) || undefined,
        utm_content: safeString(refCookie.utm_content, 120) || undefined,
        utm_term: safeString(refCookie.utm_term, 120) || undefined,
        landing: safeString(refCookie.landing, 500) || undefined,
        ts: Number(refCookie.ts) || undefined,
      };
    } else if (steamId) {
      const existing = await attributions.findOne({ steamId });
      if (existing?.refSlug) refSlug = String(existing.refSlug);
      if (existing?.utm) utm = existing.utm;
    }

    if (steamId && refSlug) {
      await attributions.updateOne(
        { steamId },
        {
          $set: {
            steamId,
            refSlug,
            utm,
            lastSeenAt: new Date(),
            sid,
          },
          $setOnInsert: {
            firstSeenAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    const now = new Date();
    const doc = {
      event,
      createdAt: now,
      day: now.toISOString().slice(0, 10),
      path: path || undefined,
      title: title || undefined,
      steamId,
      sid,
      refSlug,
      utm,
      value: typeof body.value === 'number' && Number.isFinite(body.value) ? body.value : undefined,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
      ua: safeString(req.headers.get('user-agent'), 300) || undefined,
      referer: safeString(req.headers.get('referer'), 500) || undefined,
    };

    await db.collection('analytics_events').insertOne(doc);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
