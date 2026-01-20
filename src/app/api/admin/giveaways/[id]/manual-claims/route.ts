import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';

export const runtime = 'nodejs';

type ManualClaimStatus = 'pending' | 'contacted' | 'awaiting_user' | 'sent' | 'completed' | 'rejected';

function normalizeManualStatus(raw: any): ManualClaimStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'contacted') return 'contacted';
  if (s === 'awaiting_user') return 'awaiting_user';
  if (s === 'sent') return 'sent';
  if (s === 'completed') return 'completed';
  if (s === 'rejected') return 'rejected';
  return 'pending';
}

function mapStatusToWinnerClaimStatus(s: ManualClaimStatus): string {
  if (s === 'pending') return 'manual_pending';
  if (s === 'contacted') return 'manual_contacted';
  if (s === 'awaiting_user') return 'manual_awaiting_user';
  if (s === 'sent') return 'manual_sent';
  if (s === 'completed') return 'claimed';
  return 'rejected';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

    const params = await Promise.resolve(ctx.params as any);
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let giveawayId: ObjectId;
    try {
      giveawayId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const db = await getDatabase();
    const col = db.collection('giveaway_manual_claims');

    const rows: any[] = await col
      .find({ giveawayId } as any, { projection: { giveawayId: 1, steamId: 1, discordUsername: 1, discordId: 1, email: 1, status: 1, createdAt: 1, updatedAt: 1, webhookSentAt: 1, lastWebhookError: 1 } } as any)
      .sort({ updatedAt: -1 })
      .limit(250)
      .toArray();

    const out = rows.map((r: any) => {
      const discordId = r?.discordId ? String(r.discordId) : null;
      return {
        id: String(r?._id || ''),
        giveawayId: id,
        steamId: String(r?.steamId || ''),
        discordUsername: String(r?.discordUsername || ''),
        discordId,
        discordProfileUrl: discordId ? `https://discord.com/users/${encodeURIComponent(discordId)}` : null,
        email: r?.email ? String(r.email) : null,
        status: String(r?.status || 'pending'),
        createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
        updatedAt: r?.updatedAt ? new Date(r.updatedAt).toISOString() : null,
        webhookSentAt: r?.webhookSentAt ? new Date(r.webhookSentAt).toISOString() : null,
        lastWebhookError: r?.lastWebhookError ? String(r.lastWebhookError) : null,
      };
    });

    const res = NextResponse.json({ ok: true, giveawayId: id, claims: out }, { status: 200 });
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load manual claims' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId || !isOwner(steamId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (!hasMongoConfig()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

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
    const claimIdRaw = String(body?.claimId || '').trim();
    if (!claimIdRaw) return NextResponse.json({ error: 'Missing claimId' }, { status: 400 });

    let claimOid: ObjectId;
    try {
      claimOid = new ObjectId(claimIdRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid claimId' }, { status: 400 });
    }

    const nextStatus = normalizeManualStatus(body?.status);

    const db = await getDatabase();
    const col = db.collection('giveaway_manual_claims');
    const winnersCol = db.collection('giveaway_winners');

    const now = new Date();

    const doc: any = await col.findOne({ _id: claimOid, giveawayId } as any, { projection: { steamId: 1 } } as any);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await col.updateOne(
      { _id: claimOid } as any,
      {
        $set: {
          status: nextStatus,
          updatedAt: now,
          ...(nextStatus === 'completed' ? { completedAt: now } : {}),
          ...(nextStatus === 'rejected' ? { rejectedAt: now } : {}),
        },
      } as any
    );

    const winnerStatus = mapStatusToWinnerClaimStatus(nextStatus);
    const winnerDocId = id;

    await winnersCol.updateOne(
      { _id: winnerDocId } as any,
      {
        $set: {
          'winners.$[w].claimStatus': winnerStatus,
          updatedAt: now,
          ...(nextStatus === 'completed' ? { 'winners.$[w].claimedAt': now } : {}),
          ...(nextStatus === 'rejected' ? { 'winners.$[w].forfeitedAt': now } : {}),
        },
      } as any,
      { arrayFilters: [{ 'w.steamId': String(doc?.steamId || '') } as any] }
    );

    return NextResponse.json({ ok: true, claimId: claimIdRaw, status: nextStatus }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update manual claim' }, { status: 500 });
  }
}
