import { NextResponse } from 'next/server';
import { getProUntil } from '@/app/utils/pro-storage';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const steamId = url.searchParams.get('id');

  if (!steamId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const proUntil = await getProUntil(steamId);
    return NextResponse.json({ proUntil });
  } catch (error) {
    console.error('Failed to get Pro status:', error);
    return NextResponse.json({ error: 'Failed to get Pro status' }, { status: 500 });
  }
}

