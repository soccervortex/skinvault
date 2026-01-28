import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getChatDatabase, getDatabase, hasChatMongoConfig, hasMongoConfig } from '@/app/utils/mongodb-client';
import { isOwnerRequest } from '@/app/utils/admin-auth';

export const runtime = 'nodejs';

type MigrationCollectionReport = {
  name: string;
  sourceCount: number;
  upserted: number;
  modified: number;
  errors: number;
};

function sortChatCacheCollections(names: string[]): string[] {
  const dated = names.filter((n) => n.startsWith('chats_') || n.startsWith('dms_')).sort((a, b) => b.localeCompare(a));
  const rest = names.filter((n) => !(n.startsWith('chats_') || n.startsWith('dms_'))).sort((a, b) => a.localeCompare(b));
  return [...dated, ...rest];
}

function isChatCacheCollectionName(name: string): boolean {
  if (!name) return false;
  if (name.startsWith('chats_')) return true;
  if (name.startsWith('dms_')) return true;
  if (name === 'dm_invites') return true;
  if (name === 'chat_backups') return true;
  if (name === 'dm_backups') return true;
  if (name === 'chat_reports') return true;
  if (name === 'inventory_cache') return true;
  if (name === 'surprise_cache') return true;
  if (name === 'market_items_cache') return true;
  if (name === 'surprise_bad_items') return true;
  return false;
}

async function migrateCollection(params: {
  sourceDb: any;
  targetDb: any;
  name: string;
  dryRun: boolean;
  batchSize: number;
}): Promise<MigrationCollectionReport> {
  const { sourceDb, targetDb, name, dryRun, batchSize } = params;

  const out: MigrationCollectionReport = {
    name,
    sourceCount: 0,
    upserted: 0,
    modified: 0,
    errors: 0,
  };

  const sourceCol = sourceDb.collection(name);
  const targetCol = targetDb.collection(name);

  try {
    out.sourceCount = await sourceCol.estimatedDocumentCount().catch(() => 0);
  } catch {
    out.sourceCount = 0;
  }

  if (dryRun) return out;

  const cursor = sourceCol.find({}, { batchSize });
  let ops: any[] = [];

  const flush = async () => {
    if (!ops.length) return;
    try {
      const res = await targetCol.bulkWrite(ops, { ordered: false });
      out.upserted += Number(res?.upsertedCount || 0);
      out.modified += Number(res?.modifiedCount || 0);
    } catch {
      out.errors += ops.length;
    } finally {
      ops = [];
    }
  };

  try {
    for await (const doc of cursor) {
      const id = (doc as any)?._id;
      if (id === undefined || id === null) continue;
      ops.push({ replaceOne: { filter: { _id: id }, replacement: doc, upsert: true } });
      if (ops.length >= batchSize) {
        await flush();
      }
    }
    await flush();
  } catch {
    out.errors += ops.length || 1;
  }

  return out;
}

export async function POST(request: NextRequest) {
  if (!isOwnerRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Core MongoDB not configured (MONGODB_CLUSTER_1)' }, { status: 400 });
  }

  if (!hasChatMongoConfig()) {
    return NextResponse.json({ error: 'Chat/cache MongoDB not configured (MONGODB_CLUSTER_2+)' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = !!body?.dryRun;
  const batchSizeRaw = Number(body?.batchSize);
  const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? Math.min(2000, Math.max(50, Math.floor(batchSizeRaw))) : 500;
  const maxCollectionsRaw = Number(body?.maxCollections);
  const maxCollections = Number.isFinite(maxCollectionsRaw) && maxCollectionsRaw > 0 ? Math.min(200, Math.max(1, Math.floor(maxCollectionsRaw))) : null;

  try {
    const sourceDb = await getDatabase();
    const targetDb = await getChatDatabase();

    const collections = await sourceDb.listCollections().toArray();
    const names = collections
      .map((c: any) => String(c?.name || '').trim())
      .filter((n: string) => !!n)
      .filter(isChatCacheCollectionName);

    const ordered = sortChatCacheCollections(names);
    const selected = maxCollections ? ordered.slice(0, maxCollections) : ordered;
    const remaining = Math.max(0, ordered.length - selected.length);

    const results: MigrationCollectionReport[] = [];
    for (const name of selected) {
      const r = await migrateCollection({ sourceDb, targetDb, name, dryRun, batchSize });
      results.push(r);
    }

    const summary = {
      collections: results.length,
      remainingCollections: remaining,
      sourceDocs: results.reduce((a, r) => a + (Number(r.sourceCount) || 0), 0),
      upserted: results.reduce((a, r) => a + (Number(r.upserted) || 0), 0),
      modified: results.reduce((a, r) => a + (Number(r.modified) || 0), 0),
      errors: results.reduce((a, r) => a + (Number(r.errors) || 0), 0),
      dryRun,
    };

    return NextResponse.json({ success: true, summary, results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Migration failed' }, { status: 500 });
  }
}
