import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { dbGet, dbSet } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';
const TESTS_KEY = 'admin_mongo_connection_tests';

type TestResult = {
  ok: boolean;
  host: string | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
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

function maskMongoUri(uri: string): string {
  const host = safeHostFromUri(uri);
  if (!host) return 'mongodb://***';
  return `mongodb://***@${host}/***`;
}

async function readTests(): Promise<Record<string, TestResult>> {
  const raw = (await dbGet<Record<string, TestResult>>(TESTS_KEY, false)) || {};
  return raw && typeof raw === 'object' ? raw : {};
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const envKey = String(body?.envKey || '').trim();
  const rawUri = String(body?.uri || '').trim();

  let uri = '';
  let keyForStorage: string | null = null;

  if (envKey) {
    if (envKey === 'MONGODB_URI') {
      uri = String(process.env.MONGODB_URI || '').trim();
      keyForStorage = 'MONGODB_URI';
    } else {
      uri = String((process.env as any)[envKey] || '').trim();
      keyForStorage = envKey;
    }
  } else if (rawUri) {
    uri = rawUri;
  }

  if (!uri) {
    return NextResponse.json({ error: 'MongoDB URI not provided' }, { status: 400 });
  }

  const host = safeHostFromUri(uri);

  const started = Date.now();
  let ok = false;
  let error: string | null = null;
  let latencyMs: number | null = null;

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    maxPoolSize: 1,
    minPoolSize: 0,
  });

  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    ok = true;
  } catch (e: any) {
    ok = false;
    error = e?.message || String(e);
  } finally {
    latencyMs = Math.max(0, Date.now() - started);
    try {
      await client.close();
    } catch {
    }
  }

  const checkedAt = new Date().toISOString();

  if (keyForStorage) {
    const tests = await readTests();
    tests[keyForStorage] = { ok, host, latencyMs, error, checkedAt };
    await dbSet(TESTS_KEY, tests);
  }

  return NextResponse.json({
    ok,
    host,
    masked: maskMongoUri(uri),
    latencyMs,
    error,
    checkedAt,
    stored: !!keyForStorage,
    key: keyForStorage,
  });
}
