import { NextResponse } from 'next/server';
import { getChatDatabase } from '@/app/utils/mongodb-client';
import { getCollectionNamesForDays } from '@/app/utils/chat-collections';

export const runtime = 'nodejs';

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type PingSuggestion = {
  steamId: string;
  steamName: string;
  avatar: string;
  lastSeen: Date;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get('query') || '').trim();

    const db = await getChatDatabase();
    const collections = getCollectionNamesForDays(14);

    const bySteamId = new Map<string, PingSuggestion>();

    const nameRegex = query ? new RegExp(escapeRegExp(query), 'i') : null;
    const steamIdRegex = query && /^\d{1,17}$/.test(query) ? new RegExp(`^${escapeRegExp(query)}`) : null;

    const match: any = query
      ? {
          $or: [
            ...(nameRegex ? [{ steamName: { $regex: nameRegex } }] : []),
            ...(steamIdRegex ? [{ steamId: { $regex: steamIdRegex } }] : []),
          ],
        }
      : {};

    for (const collectionName of collections) {
      try {
        const col = db.collection<any>(collectionName);
        const cursor = col
          .find(match, {
            projection: {
              steamId: 1,
              steamName: 1,
              avatar: 1,
              timestamp: 1,
            },
          })
          .sort({ timestamp: -1 })
          .limit(query ? 100 : 50);

        const docs = await cursor.toArray();
        for (const doc of docs) {
          const steamId = String(doc?.steamId || '').trim();
          if (!/^\d{17}$/.test(steamId)) continue;

          const steamName = String(doc?.steamName || '').trim();
          const avatar = String(doc?.avatar || '').trim();
          const lastSeen = doc?.timestamp instanceof Date ? doc.timestamp : new Date(doc?.timestamp || Date.now());

          const existing = bySteamId.get(steamId);
          if (!existing || existing.lastSeen < lastSeen) {
            bySteamId.set(steamId, {
              steamId,
              steamName,
              avatar,
              lastSeen,
            });
          }

          if (bySteamId.size >= 60) break;
        }
      } catch {
      }

      if (bySteamId.size >= 60) break;
    }

    const users = Array.from(bySteamId.values())
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 8)
      .map((u) => ({
        steamId: u.steamId,
        steamName: u.steamName,
        avatar: u.avatar,
      }));

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ users: [], error: error?.message || 'Failed' }, { status: 500 });
  }
}
