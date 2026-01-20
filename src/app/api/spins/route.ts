import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { isOwner } from '@/app/utils/owner-ids';
import { readCreators } from '@/app/api/creators/route';

// --- Types ---
type DailySpinDoc = {
  _id: string; // composite key: steamId_day
  steamId: string;
  day: string;
  createdAt: Date;
  updatedAt?: Date;
  count?: number;
};

type SpinHistoryDoc = {
  steamId: string;
  reward: number;
  createdAt: Date;
  day: string;
  role: 'owner' | 'creator' | 'user';
};

type UserCreditsDoc = {
  _id: string; // steamId
  steamId: string;
  balance: number;
  updatedAt: Date;
};

 type CreditsLedgerDoc = {
   steamId: string;
   delta: number;
   type: string;
   createdAt: Date;
   meta?: any;
 };

function getSteamIdFromRequestOrBot(req: NextRequest): string | null {
  const sessionSteamId = getSteamIdFromRequest(req);
  if (sessionSteamId) return sessionSteamId;

  const expected = process.env.DISCORD_BOT_API_TOKEN;
  if (!expected) return null;
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) return null;

  const url = new URL(req.url);
  const fromQuery = String(url.searchParams.get('steamId') || '').trim();
  const fromHeader = String(req.headers.get('x-steam-id') || '').trim();
  const steamId = fromQuery || fromHeader;
  return /^\d{17}$/.test(steamId) ? steamId : null;
}

// --- Reward Logic ---
const REWARDS = [
  { reward: 10, weight: 50 },
  { reward: 25, weight: 30 },
  { reward: 50, weight: 15 },
  { reward: 100, weight: 4 },
  { reward: 500, weight: 0.9 },
  { reward: 1000, weight: 0.08 },
  { reward: 2000, weight: 0.015 },
  { reward: 5000, weight: 0.003 },
  { reward: 10000, weight: 0.0007 },
  { reward: 30000, weight: 0.0003 }
];

function getWeightedReward() {
  const totalWeight = REWARDS.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of REWARDS) {
    if (random < item.weight) {
      return item.reward;
    }
    random -= item.weight;
  }
  return REWARDS[0].reward; // Fallback
}

// --- Date Helpers ---
function dayKeyUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nextMidnightUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

function getCreatorDailyLimit(): number {
  const raw = Number(process.env.CREATOR_SPINS_PER_DAY || 25);
  if (!Number.isFinite(raw)) return 25;
  return Math.max(1, Math.floor(raw));
}

async function getRoleAndLimit(steamId: string): Promise<{ role: 'owner' | 'creator' | 'user'; dailyLimit: number | null }> {
  if (isOwner(steamId)) return { role: 'owner', dailyLimit: null };
  try {
    const creators = await readCreators();
    const isCreator = creators.some((c) => String(c?.partnerSteamId || '').trim() === steamId);
    if (isCreator) return { role: 'creator', dailyLimit: getCreatorDailyLimit() };
  } catch {
  }
  return { role: 'user', dailyLimit: 1 };
}

function usedCountFromDoc(doc: DailySpinDoc | null): number {
  if (!doc) return 0;
  if (typeof doc.count === 'number' && Number.isFinite(doc.count)) return Math.max(0, Math.floor(doc.count));
  // Backward compatibility: old schema inserted one doc per day.
  return 1;
}

function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

// --- API Handlers ---
export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequestOrBot(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const db = await getDatabase();
  const spinsCol = db.collection<DailySpinDoc>('daily_spins');
  const { role, dailyLimit } = await getRoleAndLimit(steamId);
  const now = new Date();
  const today = dayKeyUtc(now);
  const spinKey = `${steamId}_${today}`;

  if (dailyLimit === null) {
    return NextResponse.json({
      canSpin: true,
      role,
      dailyLimit: null,
      usedSpins: 0,
      remainingSpins: null,
      nextEligibleAt: now.toISOString(),
    });
  }

  const doc = await spinsCol.findOne({ _id: spinKey });
  const usedSpins = usedCountFromDoc(doc);
  const remainingSpins = Math.max(0, dailyLimit - usedSpins);
  const canSpin = remainingSpins > 0;

  return NextResponse.json({
    canSpin,
    role,
    dailyLimit,
    usedSpins,
    remainingSpins,
    nextEligibleAt: canSpin ? now.toISOString() : nextMidnightUtc(now).toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequestOrBot(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const db = await getDatabase();
  const spinsCol = db.collection<DailySpinDoc>('daily_spins');
  const creditsCol = db.collection<UserCreditsDoc>('user_credits');
  const historyCol = db.collection<SpinHistoryDoc>('spin_history');
  const ledgerCol = db.collection<CreditsLedgerDoc>('credits_ledger');
  const { role, dailyLimit } = await getRoleAndLimit(steamId);
  const now = new Date();
  const today = dayKeyUtc(now);
  const spinKey = `${steamId}_${today}`;

  if (dailyLimit !== null) {
    const existing = await spinsCol.findOne({ _id: spinKey });
    const used = usedCountFromDoc(existing);
    if (used >= dailyLimit) {
      return NextResponse.json({
        error: 'Spin limit reached',
        dailyLimit,
        usedSpins: used,
        remainingSpins: 0,
        nextEligibleAt: nextMidnightUtc(now).toISOString(),
      }, { status: 400 });
    }

    if (!existing) {
      try {
        await spinsCol.insertOne({ _id: spinKey, steamId, day: today, createdAt: now, updatedAt: now, count: 1 });
      } catch (e: any) {
        if (e?.code === 11000) {
          // race; fall back to increment
          await spinsCol.updateOne({ _id: spinKey }, { $inc: { count: 1 }, $set: { updatedAt: now } });
        } else {
          throw e;
        }
      }
    } else {
      // Backwards compat: if count was missing, usedCountFromDoc() treats it as 1.
      // So the next count should become used + 1 (e.g. 2), not 1.
      if (typeof existing.count !== 'number' || !Number.isFinite(existing.count)) {
        await spinsCol.updateOne(
          { _id: spinKey },
          { $set: { count: used + 1, updatedAt: now } }
        );
      } else {
        await spinsCol.updateOne({ _id: spinKey }, { $inc: { count: 1 }, $set: { updatedAt: now } });
      }
    }
  }

  const reward = getWeightedReward();

  const updated = await creditsCol.findOneAndUpdate(
    { _id: steamId },
    {
      $inc: { balance: reward },
      $set: { updatedAt: now },
      $setOnInsert: { _id: steamId, steamId }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const updatedDoc = (updated as any)?.value ?? null;
  let newBalance = Number(updatedDoc?.balance);
  if (!Number.isFinite(newBalance)) {
    try {
      const reread = await creditsCol.findOne({ _id: steamId } as any, { projection: { balance: 1 } } as any);
      newBalance = Number((reread as any)?.balance);
    } catch {
      newBalance = NaN;
    }
  }
  if (!Number.isFinite(newBalance)) {
    console.warn('[spins] newBalance missing after update', {
      steamId,
      reward,
      gotValue: !!updatedDoc,
      balanceType: typeof (updatedDoc as any)?.balance,
    });
    newBalance = 0;
  }

  await ledgerCol.insertOne({
    steamId,
    delta: reward,
    type: 'spin',
    createdAt: now,
    meta: { day: today, role },
  });

  try {
    await historyCol.insertOne({ steamId, reward, createdAt: now, day: today, role });
    // Rolling 7 day retention
    await historyCol.deleteMany({ createdAt: { $lt: retentionCutoff(now) } });
  } catch {
    // ignore logging failures
  }

  return NextResponse.json({
    reward,
    newBalance,
    role,
    dailyLimit,
  });
}
