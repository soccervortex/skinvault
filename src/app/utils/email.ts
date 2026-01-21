import { sanitizeEmail, sanitizeString } from '@/app/utils/sanitize';

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return { ok: false, error: 'Email not configured' };

  const to = sanitizeEmail(args.to);
  if (!to) return { ok: false, error: 'Invalid recipient email' };

  const from = sanitizeString(String(process.env.TRANSACTIONAL_EMAIL_FROM || process.env.EMAIL_FROM || '')).trim();
  if (!from) return { ok: false, error: 'Missing EMAIL_FROM' };

  const reply_to = args.replyTo ? sanitizeEmail(args.replyTo) : sanitizeEmail(String(process.env.EMAIL_REPLY_TO || ''));

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: sanitizeString(args.subject).slice(0, 200),
        html: String(args.html || ''),
        text: args.text ? String(args.text) : undefined,
        reply_to: reply_to || undefined,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: String(json?.message || json?.error || res.statusText || 'Failed to send email') };
    }

    const id = typeof json?.id === 'string' ? json.id : undefined;
    return { ok: true, id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || 'Failed to send email') };
  }
}
