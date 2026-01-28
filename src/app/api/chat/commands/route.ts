import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeString } from '@/app/utils/sanitize';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (!hasMongoConfig()) {
      const res = NextResponse.json({ commands: [{ slug: 'item', description: 'Show item price' }, { slug: 'ping', description: 'Ping a user by SteamID64' }] });
      res.headers.set('cache-control', 'no-store');
      return res;
    }

    const db = await getDatabase();
    const col = db.collection('chat_commands');

    const rows = await col
      .find({ enabled: true, deleted: { $ne: true } } as any, { projection: { _id: 1, slug: 1, description: 1 } } as any)
      .sort({ _id: 1 } as any)
      .limit(200)
      .toArray();

    const commands = [{ slug: 'item', description: 'Show item price' }, { slug: 'ping', description: 'Ping a user by SteamID64' }].concat(
      (Array.isArray(rows) ? rows : [])
        .map((r: any) => ({
          slug: sanitizeString(String(r?.slug || r?._id || '')).trim().replace(/^\/+/, ''),
          description: r?.description != null ? sanitizeString(String(r.description)).trim().slice(0, 200) : '',
        }))
        .filter((c: any) => !!c.slug)
    );

    const res = NextResponse.json({ commands });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    const res = NextResponse.json({ commands: [{ slug: 'item', description: 'Show item price' }, { slug: 'ping', description: 'Ping a user by SteamID64' }] });
    res.headers.set('cache-control', 'no-store');
    return res;
  }
}
