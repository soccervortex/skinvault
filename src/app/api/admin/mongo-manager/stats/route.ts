import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
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

  const body = await request.json().catch(() => ({}));
  const envKey = String(body?.envKey || '').trim();

  let uri = '';
  if (envKey) {
    if (envKey === 'MONGODB_URI') {
      uri = String(process.env.MONGODB_URI || '').trim();
    } else {
      uri = String((process.env as any)[envKey] || '').trim();
    }
  }

  if (!uri) {
    return NextResponse.json({ error: 'Missing or invalid envKey' }, { status: 400 });
  }

  const dbName = String(process.env.MONGODB_DB_NAME || 'skinvault');
  const host = safeHostFromUri(uri);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 12000,
    connectTimeoutMS: 12000,
    maxPoolSize: 1,
    minPoolSize: 0,
  });

  try {
    await client.connect();

    const adminDb = client.db('admin');
    const pingStarted = Date.now();
    await adminDb.command({ ping: 1 });
    const pingMs = Math.max(0, Date.now() - pingStarted);

    const db = client.db(dbName);

    const stats = await db.command({ dbStats: 1, scale: 1 });
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();

    return NextResponse.json({
      envKey,
      host,
      dbName,
      pingMs,
      stats: {
        db: stats?.db ?? dbName,
        collections: stats?.collections ?? null,
        objects: stats?.objects ?? null,
        avgObjSize: stats?.avgObjSize ?? null,
        dataSize: stats?.dataSize ?? null,
        storageSize: stats?.storageSize ?? null,
        indexes: stats?.indexes ?? null,
        indexSize: stats?.indexSize ?? null,
      },
      collections: collections.map((c) => c.name).sort((a, b) => a.localeCompare(b)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load stats', host, envKey }, { status: 500 });
  } finally {
    try {
      await client.close();
    } catch {
    }
  }
}
