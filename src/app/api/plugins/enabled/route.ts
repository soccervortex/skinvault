import { NextResponse } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getEnabledPlugins } from '@/app/utils/plugins';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (!hasMongoConfig()) {
      const res = NextResponse.json({ plugins: [] });
      res.headers.set('cache-control', 'no-store');
      return res;
    }

    const db = await getDatabase();
    const plugins = await getEnabledPlugins(db as any);

    const safe = (plugins || []).map((p: any) => ({
      id: String(p?._id || ''),
      slug: String(p?.slug || p?._id || ''),
      type: String(p?.type || ''),
      config: (p?.config && typeof p.config === 'object') ? p.config : undefined,
    }));

    const res = NextResponse.json({ plugins: safe });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch {
    const res = NextResponse.json({ plugins: [] });
    res.headers.set('cache-control', 'no-store');
    return res;
  }
}
