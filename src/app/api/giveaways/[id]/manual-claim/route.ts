import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { dbGet } from '@/app/utils/database';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

export const runtime = 'nodejs';

type ManualClaimStatus = 'pending' | 'contacted' | 'awaiting_user' | 'sent' | 'completed' | 'rejected';

function isValidTradeUrl(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.hostname !== 'steamcommunity.com') return false;
    if (u.pathname !== '/tradeoffer/new/') return false;
    const partner = u.searchParams.get('partner');
    const token = u.searchParams.get('token');
    if (!partner || !/^\d+$/.test(partner)) return false;
    if (!token || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeUsername(u: string): string {
  return String(u || '')
    .split('#')[0]
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

async function resolveDiscordIdByUsername(username: string): Promise<string | null> {
  const query = normalizeUsername(username);
  if (!query) return null;

  try {
    const connections = (await dbGet<Record<string, any>>('discord_connections')) || {};
    for (const [, connection] of Object.entries(connections)) {
      if (!connection?.discordUsername) continue;

      const stored = normalizeUsername(String(connection.discordUsername));
      if (stored === query || stored.includes(query) || query.includes(stored)) {
        const did = String(connection.discordId || '').trim();
        return did || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function resolveDiscordIdForClaim(steamId: string, discordUsername: string): Promise<string | null> {
  const sid = String(steamId || '').trim();
  if (!sid) return null;

  try {
    const connections = (await dbGet<Record<string, any>>('discord_connections')) || {};
    const direct = connections[sid];
    const directId = direct?.discordId ? String(direct.discordId).trim() : '';
    if (directId) return directId;
  } catch {
  }

  return await resolveDiscordIdByUsername(discordUsername);
}

function isValidDiscordId(raw: string): boolean {
  const s = String(raw || '').trim();
  return /^\d{17,20}$/.test(s);
}

function mapStatusToWinnerClaimStatus(s: ManualClaimStatus): string {
  if (s === 'pending') return 'manual_pending';
  if (s === 'contacted') return 'manual_contacted';
  if (s === 'awaiting_user') return 'manual_awaiting_user';
  if (s === 'sent') return 'manual_sent';
  if (s === 'completed') return 'claimed';
  return 'rejected';
}

function sanitizeEmail(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.length > 120) return '';
  if (!/^\S+@\S+\.[A-Za-z]{2,}$/.test(s)) return '';
  return s;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const steamIdInput = String(body?.steamId || '').trim();
    const discordUsername = String(body?.discordUsername || '').trim();
    const discordIdInput = String(body?.discordId || '').trim();
    const email = sanitizeEmail(String(body?.email || ''));

    if (steamIdInput !== steamId) {
      return NextResponse.json({ error: 'Steam ID does not match your session' }, { status: 400 });
    }

    if (!discordUsername) {
      return NextResponse.json({ error: 'Discord username is required' }, { status: 400 });
    }

    if (!isValidDiscordId(discordIdInput)) {
      return NextResponse.json({ error: 'Discord ID is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const giveawaysCol = db.collection('giveaways');
    const winnersCol = db.collection('giveaway_winners');
    const manualClaimsCol = db.collection('giveaway_manual_claims');
    const settingsCol = db.collection('user_settings');

    const giveaway: any = await giveawaysCol.findOne(
      { _id: giveawayId } as any,
      { projection: { _id: 1, title: 1, prize: 1, claimMode: 1 } } as any
    );
    if (!giveaway || giveaway?.archivedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const claimMode = String(giveaway?.claimMode || 'bot').trim().toLowerCase() === 'manual' ? 'manual' : 'bot';
    if (claimMode !== 'manual') {
      return NextResponse.json({ error: 'This giveaway uses bot claims' }, { status: 400 });
    }

    const wdoc: any = await winnersCol.findOne({ _id: id } as any, { projection: { winners: 1 } } as any);
    const winners: any[] = Array.isArray(wdoc?.winners) ? wdoc.winners : [];
    const mine = winners.find((w) => String(w?.steamId || '') === steamId) || null;
    if (!mine) return NextResponse.json({ error: 'Not a winner' }, { status: 403 });

    const currentStatus = String(mine?.claimStatus || '');
    if (currentStatus === 'claimed') return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
    if (currentStatus === 'forfeited') return NextResponse.json({ error: 'Prize forfeited' }, { status: 400 });
    if (currentStatus === 'rejected') return NextResponse.json({ error: 'Claim rejected' }, { status: 400 });
    if (currentStatus.startsWith('manual_')) {
      return NextResponse.json({ ok: true, queued: true }, { status: 200 });
    }

    const deadlineMs = mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).getTime() : NaN;
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
      return NextResponse.json({ error: 'Claim window expired' }, { status: 400 });
    }

    const settings: any = await settingsCol.findOne({ _id: steamId } as any, { projection: { tradeUrl: 1 } } as any);
    const tradeUrl = String(settings?.tradeUrl || '').trim();
    if (!isValidTradeUrl(tradeUrl)) {
      return NextResponse.json(
        {
          error:
            'Trade URL not set. Set your Steam trade URL first: https://steamcommunity.com/tradeoffer/new/?partner=...&token=...',
          code: 'trade_url_missing',
        },
        { status: 400 }
      );
    }

    const now = new Date();

    const existing: any = await manualClaimsCol.findOne(
      { giveawayId, steamId, status: { $in: ['pending', 'contacted', 'awaiting_user', 'sent'] } } as any,
      { projection: { _id: 1 } } as any
    );
    if (existing?._id) {
      await winnersCol.updateOne(
        { _id: id } as any,
        { $set: { 'winners.$[w].claimStatus': 'manual_pending', 'winners.$[w].claimedAt': mine?.claimedAt ? mine.claimedAt : now, updatedAt: now } } as any,
        { arrayFilters: [{ 'w.steamId': steamId } as any] }
      );
      return NextResponse.json({ ok: true, queued: true }, { status: 200 });
    }

    const discordId = discordIdInput;

    const insertDoc: any = {
      giveawayId,
      giveawayIdStr: id,
      steamId,
      steamIdInput,
      discordUsername,
      discordId,
      email: email || null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const ins = await manualClaimsCol.insertOne(insertDoc as any);

    await winnersCol.updateOne(
      { _id: id } as any,
      {
        $set: {
          'winners.$[w].claimStatus': mapStatusToWinnerClaimStatus('pending'),
          'winners.$[w].claimedAt': now,
          updatedAt: now,
        },
      } as any,
      { arrayFilters: [{ 'w.steamId': steamId } as any] }
    );

    const webhookUrl = String(process.env.MANUAL_CLAIM_WEBHOOK_URL || '').trim();
    let webhookOk = false;
    let webhookError: string | null = null;

    if (webhookUrl) {
      const origin = new URL(req.url).origin;
      const discordProfileUrl = discordId ? `https://discordapp.com/users/${encodeURIComponent(discordId)}` : null;
      const userProfileUrl = `${origin}/inventory/${encodeURIComponent(steamId)}`;
      const contentLines: string[] = [];
      contentLines.push('New manual giveaway claim request');
      contentLines.push(`Giveaway: ${String(giveaway?.title || '')}`);
      contentLines.push(`SteamID: ${steamId}`);
      contentLines.push(`User Profile: ${userProfileUrl}`);
      contentLines.push(`Discord: ${discordUsername}`);
      contentLines.push(`Discord ID: ${discordId || '(not found)'}`);
      if (discordProfileUrl) contentLines.push(`Discord Profile: ${discordProfileUrl}`);
      if (email) contentLines.push(`Email: ${email}`);
      contentLines.push(`Status: pending`);

      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: contentLines.join('\n') }),
        });
        webhookOk = res.ok;
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          webhookError = `Webhook failed: ${res.status} ${txt}`.slice(0, 500);
        }
      } catch (e: any) {
        webhookError = String(e?.message || 'Webhook failed').slice(0, 500);
      }
    }

    await manualClaimsCol.updateOne(
      { _id: ins.insertedId } as any,
      {
        $set: {
          updatedAt: new Date(),
          webhookSentAt: webhookOk ? new Date() : null,
          lastWebhookError: webhookError,
        },
      } as any
    );

    return NextResponse.json({ ok: true, queued: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to submit manual claim' }, { status: 500 });
  }
}
