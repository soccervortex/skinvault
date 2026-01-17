import { NextResponse } from 'next/server';
import { closeConnection, getCachedMongoUri } from '@/app/utils/mongodb-client';

const ADMIN_HEADER = 'x-admin-key';

function safeHostFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function checkAuth(request: Request): boolean {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;
  if (expected && adminKey !== expected) return false;
  return true;
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const before = getCachedMongoUri();

  try {
    await closeConnection();
    return NextResponse.json({ success: true, message: 'Mongo pool reset', beforeHost: before ? safeHostFromUri(before) : null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to reset pool' }, { status: 500 });
  }
}
