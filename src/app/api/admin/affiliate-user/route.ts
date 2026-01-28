import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { sanitizeSteamId } from '@/app/utils/sanitize';
import { getAdminAccess, hasAdminPermission } from '@/app/utils/admin-auth';

function safeInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

type AffiliateReferralRow = {
  referredSteamId: string;
  createdAt: string | null;
  landing: string | null;
};

type AffiliateClaimRow = {
  milestoneId: string;
  referralsRequired: number;
  reward: any;
  createdAt: string | null;
};

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const access = await getAdminAccess(request);
    if (!access.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasAdminPermission(access, 'affiliate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!hasMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const steamId = sanitizeSteamId(searchParams.get('steamId'));
    const page = safeInt(searchParams.get('page'), 1, 1, 100000);
    const limit = safeInt(searchParams.get('limit'), 100, 1, 500);

    if (!steamId) {
      return NextResponse.json({ error: 'Invalid steamId' }, { status: 400 });
    }

    const db = await getDatabase();

    const referralsCol = db.collection('affiliate_referrals');
    const claimsCol = db.collection('affiliate_milestone_claims');

    const filter: any = { referrerSteamId: steamId };

    const totalReferrals = await referralsCol.countDocuments(filter);
    const skip = (page - 1) * limit;

    const referralsDocs = await referralsCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const referrals: AffiliateReferralRow[] = referralsDocs.map((d: any) => ({
      referredSteamId: String(d?.referredSteamId || d?._id || '').trim(),
      createdAt: d?.createdAt ? new Date(d.createdAt).toISOString() : null,
      landing: d?.landing ? String(d.landing) : null,
    }));

    const claimsDocs = await claimsCol.find({ steamId }).sort({ createdAt: -1 }).toArray();
    const claims: AffiliateClaimRow[] = claimsDocs.map((c: any) => ({
      milestoneId: String(c?.milestoneId || '').trim(),
      referralsRequired: Number(c?.referralsRequired || 0),
      reward: c?.reward || null,
      createdAt: c?.createdAt ? new Date(c.createdAt).toISOString() : null,
    }));

    let creditsGranted = 0;
    for (const c of claimsDocs as any[]) {
      const rt = String(c?.reward?.type || '');
      if (rt === 'credits') creditsGranted += Number(c?.reward?.amount || 0);
    }

    return NextResponse.json({
      ok: true,
      steamId,
      totals: {
        referrals: Number(totalReferrals || 0),
        claims: claims.length,
        creditsGranted,
      },
      referrals: {
        page,
        limit,
        total: Number(totalReferrals || 0),
        rows: referrals,
      },
      claims,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load affiliate user' }, { status: 500 });
  }
}
