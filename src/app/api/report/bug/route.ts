import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { sanitizeEmail, sanitizeSteamId, sanitizeString } from '@/app/utils/sanitize';
import { sendDiscordWebhook } from '@/app/utils/discord-webhook';
import { sendSmtpEmail } from '@/app/utils/smtp';

export const runtime = 'nodejs';

type BugReportBody = {
  title?: string;
  description?: string;
  steps?: string;
  expected?: string;
  actual?: string;
  pageUrl?: string;
  email?: string;
  steamId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({} as any))) as BugReportBody;

    const title = sanitizeString(String(body.title || '')).trim().slice(0, 200);
    const description = sanitizeString(String(body.description || '')).trim().slice(0, 10_000);
    const steps = sanitizeString(String(body.steps || '')).trim().slice(0, 10_000);
    const expected = sanitizeString(String(body.expected || '')).trim().slice(0, 10_000);
    const actual = sanitizeString(String(body.actual || '')).trim().slice(0, 10_000);
    const pageUrl = sanitizeString(String(body.pageUrl || '')).trim().slice(0, 2000);
    const email = sanitizeEmail(String(body.email || '')) || undefined;
    const steamId = sanitizeSteamId(String(body.steamId || '')) || undefined;

    if (!title || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userAgent = sanitizeString(request.headers.get('user-agent') || '').slice(0, 500);

    const report = {
      type: 'bug',
      title,
      description,
      steps: steps || undefined,
      expected: expected || undefined,
      actual: actual || undefined,
      pageUrl: pageUrl || undefined,
      email,
      steamId,
      userAgent: userAgent || undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    let insertedId: string | undefined;
    try {
      const db = await getDatabase();
      const res = await db.collection('reports').insertOne(report as any);
      insertedId = String(res.insertedId);
    } catch (e) {
    }

    const fields = [
      { name: 'Title', value: title || 'N/A', inline: false },
      { name: 'Steam ID', value: steamId ? `\`${steamId}\`` : 'N/A', inline: true },
      { name: 'Email', value: email || 'N/A', inline: true },
      { name: 'Page', value: pageUrl ? pageUrl.slice(0, 1024) : 'N/A', inline: false },
      { name: 'Description', value: description.slice(0, 1024) || 'N/A', inline: false },
    ];

    if (steps) fields.push({ name: 'Steps', value: steps.slice(0, 1024), inline: false });
    if (expected) fields.push({ name: 'Expected', value: expected.slice(0, 1024), inline: false });
    if (actual) fields.push({ name: 'Actual', value: actual.slice(0, 1024), inline: false });

    await sendDiscordWebhook(
      [
        {
          title: '🐞 Bug Report',
          description: insertedId ? `Report ID: \`${insertedId}\`` : 'New submission',
          color: 0xffaa00,
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'SkinVaults Reports' },
        },
      ] as any,
      'reports'
    );

    const to = sanitizeEmail(String(process.env.REPORTS_EMAIL_TO || process.env.REPORT_EMAIL_TO || ''));
    if (to) {
      const subject = `Bug Report: ${title}`;
      const text = [
        `Bug Report${insertedId ? ` (${insertedId})` : ''}`,
        '',
        `Title: ${title}`,
        `Steam ID: ${steamId || 'N/A'}`,
        `Email: ${email || 'N/A'}`,
        `Page: ${pageUrl || 'N/A'}`,
        '',
        'Description:',
        description,
        '',
        steps ? `Steps:\n${steps}\n` : '',
        expected ? `Expected:\n${expected}\n` : '',
        actual ? `Actual:\n${actual}\n` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await sendSmtpEmail({ to, subject, text });
    }

    return NextResponse.json({ ok: true, id: insertedId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
