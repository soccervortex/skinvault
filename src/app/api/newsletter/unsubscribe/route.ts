import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeEmail, sanitizeString } from '@/app/utils/sanitize';

export const runtime = 'nodejs';

type UnsubscribeBody = {
  email?: string;
};

async function unsubscribeByQuery(params: URLSearchParams): Promise<Response> {
  if (!hasMongoConfig()) {
    return new Response('Database not configured', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const token = sanitizeString(String(params.get('token') || '')).trim().slice(0, 500);
  if (!token) {
    return new Response('Missing token', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const db = await getDatabase();
  const col = db.collection('newsletter_subscribers');

  const now = new Date().toISOString();
  const result = await col.updateOne(
    { unsubscribeToken: token } as any,
    { $set: { active: false, unsubscribedAt: now, updatedAt: now } }
  );

  const ok = result.matchedCount > 0;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Unsubscribe</title></head><body style="background:#08090d;color:#fff;font-family:system-ui,Segoe UI,Roboto,Arial;padding:32px;">
  <div style="max-width:720px;margin:0 auto;background:#11141d;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:22px;">Newsletter</h1>
    <p style="margin:0;color:rgba(148,163,184,0.95);">${ok ? 'You have been unsubscribed.' : 'This unsubscribe link is invalid or already used.'}</p>
  </div>
</body></html>`;

  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return await unsubscribeByQuery(url.searchParams);
}

export async function POST(request: Request) {
  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({} as any))) as UnsubscribeBody;

    const email = sanitizeEmail(String(body.email || ''));
    if (!email) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const db = await getDatabase();
    const col = db.collection('newsletter_subscribers');

    const now = new Date().toISOString();
    await col.updateOne({ email } as any, { $set: { active: false, unsubscribedAt: now, updatedAt: now } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to unsubscribe' }, { status: 500 });
  }
}
