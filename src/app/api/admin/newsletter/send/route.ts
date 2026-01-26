import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeEmail, sanitizeString } from '@/app/utils/sanitize';
import { sendSmtpEmail } from '@/app/utils/smtp';

export const runtime = 'nodejs';

type SendBody = {
  subject?: string;
  html?: string;
  text?: string;
  max?: number;
};

export async function POST(req: NextRequest) {
  const requesterSteamId = getSteamIdFromRequest(req);
  if (!requesterSteamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOwner(requesterSteamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = (await req.json().catch(() => ({} as any))) as SendBody;
    const subject = sanitizeString(String(body.subject || '')).trim().slice(0, 200);
    const html = String(body.html || '').trim();
    const text = String(body.text || '').trim();

    if (!subject) return NextResponse.json({ error: 'Missing subject' }, { status: 400 });
    if (!html && !text) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

    const baseUrl = sanitizeString(String(process.env.NEXT_PUBLIC_BASE_URL || '')).trim().replace(/\/$/, '');

    const db = await getDatabase();
    const col = db.collection('newsletter_subscribers');

    const rawMax = Number(body.max || 5000);
    const max = Math.min(5000, Math.max(1, Math.floor(Number.isFinite(rawMax) ? rawMax : 5000)));

    const subs = await col
      .find({ active: true } as any, { projection: { _id: 0, email: 1, unsubscribeToken: 1 } })
      .limit(max)
      .toArray();

    let sent = 0;
    let failed = 0;

    for (const s of subs as any[]) {
      const to = sanitizeEmail(String(s?.email || ''));
      if (!to) continue;

      const token = sanitizeString(String(s?.unsubscribeToken || '')).trim();
      const unsubscribeUrl = baseUrl ? `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}` : '';

      const footerText = unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : '';
      const nextText = text ? `${text}${footerText}` : footerText;

      const nextHtml = html
        ? `${html}${unsubscribeUrl ? `<hr/><p style="font-size:12px;color:#94a3b8">Unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>` : ''}`
        : undefined;

      const res = await sendSmtpEmail({
        to,
        subject,
        text: nextText || '(no message)',
        html: nextHtml,
      });

      if (res.ok) sent++;
      else failed++;
    }

    return NextResponse.json({ ok: true, sent, failed, total: subs.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send newsletter' }, { status: 500 });
  }
}
