import { NextResponse } from 'next/server';
import {
  getUnpostedFeatureAnnouncements,
  markFeatureAnnouncementPosted,
} from '@/app/lib/feature-announcements';

export const runtime = 'nodejs';

function getAuthHeader(request: Request): string {
  const a = request.headers.get('authorization');
  if (a) return a;
  const b = request.headers.get('Authorization');
  return b || '';
}

function assertBotAuth(request: Request): NextResponse | null {
  const expected = process.env.DISCORD_BOT_API_TOKEN;
  if (!expected) {
    console.warn('[discord/bot/feature-announcements] No DISCORD_BOT_API_TOKEN set - allowing unauthenticated requests');
    return null;
  }

  const auth = getAuthHeader(request);
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

type MarkPostedBody = {
  id: string;
  postId: string;
};

export async function GET(request: Request) {
  const authErr = assertBotAuth(request);
  if (authErr) return authErr;

  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit') || 3);
    const limit = Math.max(1, Math.min(10, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 3)));

    const announcements = await getUnpostedFeatureAnnouncements();
    const items = announcements
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .slice(0, limit);

    return NextResponse.json({ ok: true, count: items.length, announcements: items }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to get feature announcements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authErr = assertBotAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json().catch(() => null)) as MarkPostedBody | null;
    const id = String(body?.id || '').trim();
    const postId = String(body?.postId || '').trim();

    if (!id || !postId) {
      return NextResponse.json({ error: 'Missing id or postId' }, { status: 400 });
    }

    await markFeatureAnnouncementPosted(id, postId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to mark announcement posted' }, { status: 500 });
  }
}
