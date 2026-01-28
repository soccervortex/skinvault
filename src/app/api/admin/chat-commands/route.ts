import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeString } from '@/app/utils/sanitize';
import { listChatCommands, normalizeChatCommandSlug } from '@/app/utils/chat-commands';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

export const runtime = 'nodejs';

type CreateBody = {
  slug?: string;
  description?: string;
  response?: string;
  enabled?: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!hasAdminPermission(access, 'chat_commands')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === '1';

    const db = await getDatabase();
    const commands = await listChatCommands(db, includeDeleted);

    const res = NextResponse.json({ commands });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load commands' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!hasAdminPermission(access, 'chat_commands')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as CreateBody | null;

    const slug = normalizeChatCommandSlug(body?.slug);
    const description = sanitizeString(String(body?.description || '')).trim().slice(0, 200) || null;
    const response = sanitizeString(String(body?.response || '')).trim().slice(0, 900);
    const enabled = body?.enabled === true;

    if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    if (!response) return NextResponse.json({ error: 'Missing response' }, { status: 400 });

    const now = new Date().toISOString();
    const db = await getDatabase();
    const col = db.collection('chat_commands');

    const existing = await col.findOne({ _id: slug } as any);
    if (existing && existing.deleted !== true) {
      return NextResponse.json({ error: 'Command already exists' }, { status: 409 });
    }

    await col.updateOne(
      { _id: slug } as any,
      {
        $setOnInsert: {
          _id: slug,
          createdAt: now,
        } as any,
        $set: {
          slug,
          description,
          response,
          enabled,
          deleted: false,
          updatedAt: now,
        } as any,
      } as any,
      { upsert: true }
    );

    const commands = await listChatCommands(db, true);
    const command = commands.find((c) => c._id === slug) || null;

    return NextResponse.json({ ok: true, command });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create command' }, { status: 500 });
  }
}
