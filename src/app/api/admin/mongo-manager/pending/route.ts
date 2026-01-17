import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';
const PENDING_KEY = 'admin_pending_mongo_clusters';

type PendingCluster = {
  idx: number;
  envKey: string;
  host: string | null;
  createdAt: string;
  deployed?: boolean;
  deployedAt?: string;
};

function checkAuth(request: Request): boolean {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;
  if (expected && adminKey !== expected) return false;
  return true;
}

function safeHostFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.hostname || null;
  } catch {
    return null;
  }
}

async function readPending(): Promise<PendingCluster[]> {
  const raw = (await dbGet<PendingCluster[]>(PENDING_KEY, false)) || [];
  return Array.isArray(raw) ? raw : [];
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pending = await readPending();
  return NextResponse.json({ pending });
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const idx = Number(body?.idx);
  const uri = String(body?.uri || '').trim();

  if (!Number.isFinite(idx) || idx < 1 || !Number.isInteger(idx)) {
    return NextResponse.json({ error: 'Invalid idx' }, { status: 400 });
  }

  if (!uri) {
    return NextResponse.json({ error: 'Missing uri' }, { status: 400 });
  }

  const envKey = `MONGODB_CLUSTER_${idx}`;

  let pending = await readPending();
  if (pending.some((p) => p.envKey === envKey)) {
    return NextResponse.json({ error: `${envKey} already pending` }, { status: 400 });
  }

  pending = pending.filter((p) => p.idx !== idx);

  const createdAt = new Date().toISOString();
  const host = safeHostFromUri(uri);

  const entry: PendingCluster = {
    idx,
    envKey,
    host,
    createdAt,
    deployed: false,
  };

  pending.push(entry);
  pending.sort((a, b) => a.idx - b.idx);

  const ok = await dbSet(PENDING_KEY, pending);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to persist pending connections (database not available)' }, { status: 500 });
  }

  return NextResponse.json({ success: true, pending: entry });
}

export async function DELETE(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const envKey = String(searchParams.get('envKey') || '').trim();
  const idxRaw = searchParams.get('idx');

  let pending = await readPending();

  const before = pending.length;
  if (envKey) {
    pending = pending.filter((p) => p.envKey !== envKey);
  } else if (idxRaw) {
    const idx = Number(idxRaw);
    pending = pending.filter((p) => p.idx !== idx);
  } else {
    return NextResponse.json({ error: 'Missing envKey or idx' }, { status: 400 });
  }

  if (pending.length === before) {
    return NextResponse.json({ success: true, removed: 0 });
  }

  const ok = await dbSet(PENDING_KEY, pending);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to persist pending connections (database not available)' }, { status: 500 });
  }
  return NextResponse.json({ success: true, removed: before - pending.length });
}
