import { NextResponse } from 'next/server';
import { getPrimeUntil } from '@/app/utils/prime-storage';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const steamId = url.searchParams.get('id');

  if (!steamId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const primeUntil = await getPrimeUntil(steamId);
    return NextResponse.json({ primeUntil });
  } catch (error) {
    console.error('Failed to get Prime status:', error);
    return NextResponse.json({ error: 'Failed to get Prime status' }, { status: 500 });
  }
}

