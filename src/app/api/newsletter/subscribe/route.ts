import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeEmail, sanitizeSteamId, sanitizeString } from '@/app/utils/sanitize';

export const runtime = 'nodejs';

type SubscribeBody = {
  email?: string;
  steamId?: string;
  source?: string;
};

function makeToken(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export async function POST(request: Request) {
  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({} as any))) as SubscribeBody;

    const email = sanitizeEmail(String(body.email || ''));
    if (!email) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const steamId = sanitizeSteamId(body.steamId) || undefined;
    const source = sanitizeString(String(body.source || '')).trim().slice(0, 200) || undefined;

    const db = await getDatabase();
    const col = db.collection('newsletter_subscribers');

    const now = new Date().toISOString();

    const existing = await col.findOne({ email } as any);
    if (existing?.active) {
      return NextResponse.json({ ok: true, status: 'already_subscribed' });
    }

    const unsubscribeToken = existing?.unsubscribeToken || makeToken();

    await col.updateOne(
      { email } as any,
      {
        $set: {
          email,
          steamId: steamId || existing?.steamId || undefined,
          active: true,
          subscribedAt: existing?.subscribedAt || now,
          resubscribedAt: existing ? now : undefined,
          unsubscribedAt: null,
          unsubscribeToken,
          source: source || existing?.source || undefined,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, status: 'subscribed' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to subscribe' }, { status: 500 });
  }
}
