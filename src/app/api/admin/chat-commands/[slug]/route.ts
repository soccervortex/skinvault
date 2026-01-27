import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { sanitizeString } from '@/app/utils/sanitize';
import { listChatCommands, normalizeChatCommandSlug } from '@/app/utils/chat-commands';

export const runtime = 'nodejs';

const ADMIN_HEADER = 'x-admin-key';

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_PRO_TOKEN;
  const adminKey = request.headers.get(ADMIN_HEADER);

  if (expected && adminKey === expected) return true;

  const steamId = getSteamIdFromRequest(request);
  if (steamId && isOwner(steamId)) return true;

  return false;
}

type PatchBody = {
  description?: string | null;
  response?: string;
  enabled?: boolean;
};

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const slug = normalizeChatCommandSlug(params?.slug);
    if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

    const body = (await request.json().catch(() => null)) as PatchBody | null;

    const db = await getDatabase();
    const col = db.collection('chat_commands');
    const existing = await col.findOne({ _id: slug } as any);

    if (!existing || existing.deleted === true) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 });
    }

    const patch: Record<string, any> = {};

    if (typeof body?.enabled === 'boolean') {
      patch.enabled = body.enabled;
    }

    if (typeof body?.description !== 'undefined') {
      const description = sanitizeString(String(body?.description || '')).trim().slice(0, 200) || null;
      patch.description = description;
    }

    if (typeof body?.response !== 'undefined') {
      const response = sanitizeString(String(body?.response || '')).trim().slice(0, 900);
      if (!response) return NextResponse.json({ error: 'Invalid response' }, { status: 400 });
      patch.response = response;
    }

    const now = new Date().toISOString();
    patch.updatedAt = now;

    await col.updateOne({ _id: slug } as any, { $set: patch } as any);

    const commands = await listChatCommands(db, true);
    const command = commands.find((c) => c._id === slug) || null;

    return NextResponse.json({ ok: true, command });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update command' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> | { slug: string } }) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const slug = normalizeChatCommandSlug(params?.slug);
    if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

    const db = await getDatabase();
    const col = db.collection('chat_commands');

    const existing = await col.findOne({ _id: slug } as any);
    if (!existing || existing.deleted === true) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    await col.updateOne(
      { _id: slug } as any,
      {
        $set: {
          deleted: true,
          enabled: false,
          updatedAt: now,
        },
      } as any
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete command' }, { status: 500 });
  }
}
