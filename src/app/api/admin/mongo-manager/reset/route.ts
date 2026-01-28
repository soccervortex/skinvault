import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { closeConnection, getCachedMongoUri } from '@/app/utils/mongodb-client';
import { isOwnerRequest } from '@/app/utils/admin-auth';

function safeHostFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isOwnerRequest(request)) {
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
