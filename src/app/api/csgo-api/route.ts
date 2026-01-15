import { NextResponse } from 'next/server';
import { API_FILES, API_LARGE_FILES } from '@/data/api-endpoints';

export const runtime = 'nodejs';

const DEFAULT_LANG = 'en';
const ALLOWED_LANGS = new Set(['en', 'zh-CN']);

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 12 },
    });
  } finally {
    clearTimeout(id);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const fileRaw = String(url.searchParams.get('file') || '').trim();
    const lang = String(url.searchParams.get('lang') || DEFAULT_LANG).trim();

    if (!fileRaw) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }

    const file = fileRaw.endsWith('.json') ? fileRaw : `${fileRaw}.json`;

    const allowedFiles = new Set<string>([...API_FILES, ...API_LARGE_FILES] as any);
    if (!allowedFiles.has(file)) {
      return NextResponse.json({ error: 'Unsupported file' }, { status: 400 });
    }

    const safeLang = ALLOWED_LANGS.has(lang) ? lang : DEFAULT_LANG;
    const remoteUrl = `https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/${encodeURIComponent(safeLang)}/${file}`;

    const res = await fetchWithTimeout(remoteUrl, 15000);
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream not found', status: res.status }, { status: 502 });
    }

    const text = await res.text();

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=43200',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch dataset' }, { status: 500 });
  }
}
