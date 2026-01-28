import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCollectionNamesForDays } from '@/app/utils/chat-collections';
import { getChatDatabase, getDatabase, hasChatMongoConfig, hasMongoConfig } from '@/app/utils/mongodb-client';
import { isOwnerRequest } from '@/app/utils/admin-auth';

export const runtime = 'nodejs';

type BackfillTarget = 'chat' | 'core';

type CollectionReport = {
  target: BackfillTarget;
  collection: string;
  steamIds: number;
  matched: number;
  modified: number;
  skippedNoProfile: number;
  errors: number;
};

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSteamProfileViaWebApi(steamId: string): Promise<{ name: string; avatar: string } | null> {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) return null;
    if (!/^\d{17}$/.test(String(steamId || '').trim())) return null;

    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return null;

    const data: any = await res.json().catch(() => null);
    const player = data?.response?.players?.[0];
    const name = String(player?.personaname || '').trim();
    const avatar = String(player?.avatarfull || '').trim();
    if (!name) return null;
    return { name, avatar };
  } catch {
    return null;
  }
}

function invalidName(name: unknown): boolean {
  const v = String(name ?? '').trim();
  return !v || v === 'Unknown User';
}

function invalidAvatar(avatar: unknown): boolean {
  const v = String(avatar ?? '').trim();
  return !v;
}

function invalidFieldsFilter() {
  return {
    $or: [
      { steamName: { $exists: false } },
      { steamName: { $in: ['', null, 'Unknown User'] } },
      { avatar: { $exists: false } },
      { avatar: { $in: ['', null] } },
    ],
  };
}

async function backfillDb(params: {
  target: BackfillTarget;
  db: any;
  collections: string[];
  dryRun: boolean;
  maxSteamIds: number;
  maxUpdates: number;
}): Promise<CollectionReport[]> {
  const { target, db, collections, dryRun, maxSteamIds, maxUpdates } = params;

  const out: CollectionReport[] = [];
  const profileCache = new Map<string, { name: string; avatar: string } | null>();
  let remainingUpdates = maxUpdates;

  for (const collectionName of collections) {
    if (remainingUpdates <= 0) break;

    const report: CollectionReport = {
      target,
      collection: collectionName,
      steamIds: 0,
      matched: 0,
      modified: 0,
      skippedNoProfile: 0,
      errors: 0,
    };

    try {
      const exists = await db
        .listCollections({ name: collectionName }, { nameOnly: true })
        .toArray()
        .then((arr: any[]) => (arr?.length ? true : false))
        .catch(() => false);

      if (!exists) {
        out.push(report);
        continue;
      }

      const col = db.collection(collectionName);

      const steamIds = (await col.distinct('steamId', invalidFieldsFilter()).catch(() => [])) as string[];
      const unique = Array.from(
        new Set(
          steamIds
            .map((s) => String(s || '').trim())
            .filter((s) => !!s)
            .slice(0, maxSteamIds)
        )
      );

      report.steamIds = unique.length;

      for (const steamId of unique) {
        if (remainingUpdates <= 0) break;

        let profile = profileCache.get(steamId);
        if (profile === undefined) {
          profile = await fetchSteamProfileViaWebApi(steamId);
          profileCache.set(steamId, profile);
        }

        if (!profile || invalidName(profile.name)) {
          report.skippedNoProfile += 1;
          continue;
        }

        const update: any = { $set: { steamName: profile.name } };
        if (profile.avatar && !invalidAvatar(profile.avatar)) {
          update.$set.avatar = profile.avatar;
        }

        if (dryRun) {
          const count = await col
            .countDocuments({ steamId, ...invalidFieldsFilter() })
            .catch(() => 0);
          report.matched += Number(count || 0);
          continue;
        }

        const res = await col
          .updateMany({ steamId, ...invalidFieldsFilter() }, update)
          .catch(() => null);

        const matched = Number((res as any)?.matchedCount || 0);
        const modified = Number((res as any)?.modifiedCount || 0);

        report.matched += matched;
        report.modified += modified;
        remainingUpdates -= modified;
      }

      out.push(report);
    } catch {
      report.errors += 1;
      out.push(report);
    }
  }

  return out;
}

export async function POST(request: NextRequest) {
  if (!isOwnerRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.STEAM_API_KEY) {
    return NextResponse.json({ error: 'STEAM_API_KEY is not configured' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = !!body?.dryRun;
  const daysRaw = Number(body?.days);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(60, Math.max(1, Math.floor(daysRaw))) : 7;

  const maxSteamIdsRaw = Number(body?.maxSteamIds);
  const maxSteamIds =
    Number.isFinite(maxSteamIdsRaw) && maxSteamIdsRaw > 0 ? Math.min(2000, Math.max(10, Math.floor(maxSteamIdsRaw))) : 300;

  const maxUpdatesRaw = Number(body?.maxUpdates);
  const maxUpdates =
    Number.isFinite(maxUpdatesRaw) && maxUpdatesRaw > 0 ? Math.min(50000, Math.max(100, Math.floor(maxUpdatesRaw))) : 5000;

  const includeChat = body?.includeChat !== false;
  const includeCore = body?.includeCore !== false;

  const collections = getCollectionNamesForDays(days);

  const results: CollectionReport[] = [];

  try {
    if (includeChat && hasChatMongoConfig()) {
      const chatDb = await getChatDatabase();
      results.push(
        ...(await backfillDb({
          target: 'chat',
          db: chatDb,
          collections,
          dryRun,
          maxSteamIds,
          maxUpdates,
        }))
      );
    }

    if (includeCore && hasMongoConfig()) {
      const coreDb = await getDatabase();
      results.push(
        ...(await backfillDb({
          target: 'core',
          db: coreDb,
          collections,
          dryRun,
          maxSteamIds,
          maxUpdates,
        }))
      );
    }

    const summary = {
      dryRun,
      days,
      maxSteamIds,
      maxUpdates,
      includeChat,
      includeCore,
      collections: results.length,
      steamIds: results.reduce((a, r) => a + (Number(r.steamIds) || 0), 0),
      matched: results.reduce((a, r) => a + (Number(r.matched) || 0), 0),
      modified: results.reduce((a, r) => a + (Number(r.modified) || 0), 0),
      skippedNoProfile: results.reduce((a, r) => a + (Number(r.skippedNoProfile) || 0), 0),
      errors: results.reduce((a, r) => a + (Number(r.errors) || 0), 0),
    };

    return NextResponse.json({ success: true, summary, results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Backfill failed' }, { status: 500 });
  }
}
