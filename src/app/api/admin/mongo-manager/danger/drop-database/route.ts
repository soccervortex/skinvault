import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { isOwnerRequest } from '@/app/utils/admin-auth';

function getUriForEnvKey(envKey: string): string {
  const key = String(envKey || '').trim();
  if (!key) return '';
  if (key === 'MONGODB_URI') return String(process.env.MONGODB_URI || '').trim();
  return String((process.env as any)[key] || '').trim();
}

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

  const body = await request.json().catch(() => ({}));
  const envKey = String(body?.envKey || '').trim();
  const confirm = String(body?.confirm || '').trim();

  if (!envKey) return NextResponse.json({ error: 'Missing envKey' }, { status: 400 });

  const dbName = String(process.env.MONGODB_DB_NAME || 'skinvault');
  const requiredConfirm = `DROP DATABASE ${dbName}`;

  if (confirm !== requiredConfirm) {
    return NextResponse.json({ error: `Confirmation mismatch. Type: ${requiredConfirm}` }, { status: 400 });
  }

  const uri = getUriForEnvKey(envKey);
  if (!uri) {
    return NextResponse.json({ error: 'Mongo URI not configured for this envKey' }, { status: 400 });
  }

  const host = safeHostFromUri(uri);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    maxPoolSize: 2,
    minPoolSize: 0,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const result = await db.dropDatabase();
    return NextResponse.json({ success: true, envKey, host, dbName, result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to drop database', envKey, host, dbName }, { status: 500 });
  } finally {
    try {
      await client.close();
    } catch {
    }
  }
}
