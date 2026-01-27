import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { escapeHtml, sanitizeEmail, sanitizeString } from '@/app/utils/sanitize';
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
    const replyTo =
      sanitizeEmail(String(process.env.SMTP_REPLY_TO || '').trim()) ||
      sanitizeEmail(String(process.env.SMTP_USER || '').trim()) ||
      undefined;

    const logoUrl = baseUrl ? `${baseUrl}/icon.png` : '';

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
    const failures: { to: string; error: string }[] = [];

    for (const s of subs as any[]) {
      const to = sanitizeEmail(String(s?.email || ''));
      if (!to) continue;

      const token = sanitizeString(String(s?.unsubscribeToken || '')).trim();
      const unsubscribeUrl = baseUrl ? `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}` : '';

      const footerText = unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : '';
      const nextText = text ? `${text}${footerText}` : footerText;

      const unsubscribeHtml = unsubscribeUrl
        ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/><p style="margin:0;font-size:12px;line-height:1.4;color:#64748b">Unsubscribe: <a href="${unsubscribeUrl}" style="color:#2563eb;text-decoration:none">${unsubscribeUrl}</a></p>`
        : '';

      const headerHtml = logoUrl
        ? `<div style="text-align:center;margin:0 0 18px"><img src="${logoUrl}" alt="SkinVaults" width="56" height="56" style="display:inline-block;border-radius:14px"/></div>`
        : `<div style="text-align:center;margin:0 0 18px;font-size:22px;font-weight:800;letter-spacing:0.4px;color:#0b1220">SkinVaults</div>`;

      const bodyHtml = html
        ? html
        : `<p style="margin:0;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#0b1220">${escapeHtml(nextText || '')}</p>`;

      const nextHtml = `<!doctype html><html><body style="margin:0;padding:24px;background:#0b0f19;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;padding:24px">${headerHtml}<div>${bodyHtml}</div>${unsubscribeHtml}</div></body></html>`;

      const res = await sendSmtpEmail({
        to,
        subject,
        text: nextText || '(no message)',
        html: nextHtml,
        replyTo,
      });

      if (res.ok) sent++;
      else {
        failed++;
        if (failures.length < 5) {
          failures.push({ to, error: sanitizeString(String(res.error || 'Failed to send')).slice(0, 800) });
        }
      }
    }

    return NextResponse.json({ ok: true, sent, failed, total: subs.length, failures });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send newsletter' }, { status: 500 });
  }
}
