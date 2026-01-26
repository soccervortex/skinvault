import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';
import { normalizeSteamCurrencyCode } from '@/app/utils/currency-preference';

type DiscordUserPrefs = {
  currency?: string;
  updatedAt?: string;
};

const PREFS_KEY = 'discord_user_prefs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const discordId = url.searchParams.get('discordId');

    if (!discordId) {
      return NextResponse.json({ error: 'Missing discordId' }, { status: 400 });
    }

    const prefs = (await dbGet<Record<string, DiscordUserPrefs>>(PREFS_KEY)) || {};
    const p = prefs[discordId] || {};

    return NextResponse.json({
      discordId,
      currency: p.currency || '3',
      updatedAt: p.updatedAt || null,
    });
  } catch (error) {
    console.error('Discord preferences GET error:', error);
    return NextResponse.json({ error: 'Failed to get preferences' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const discordId = body?.discordId;
    const currencyRaw = body?.currency;
    const currency = normalizeSteamCurrencyCode(String(currencyRaw || ''));

    if (!discordId || !currency) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const prefs = (await dbGet<Record<string, DiscordUserPrefs>>(PREFS_KEY)) || {};
    prefs[String(discordId)] = {
      ...(prefs[String(discordId)] || {}),
      currency,
      updatedAt: new Date().toISOString(),
    };

    await dbSet(PREFS_KEY, prefs);

    return NextResponse.json({ success: true, discordId, currency });
  } catch (error) {
    console.error('Discord preferences POST error:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
