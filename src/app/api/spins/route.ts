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
  usedBonus?: boolean;
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
  { reward: 10, weight: 19.5 },
  { reward: 25, weight: 17.5 },
  { reward: 50, weight: 22 },
  { reward: 100, weight: 18 },
  { reward: 500, weight: 12 },
  { reward: 1000, weight: 6.5 },
  { reward: 2000, weight: 2.5 },
  { reward: 5000, weight: 1 },
  { reward: 10000, weight: 0.5 },
  { reward: 30000, weight: 0.25 },
  { reward: 50000, weight: 0.12 },
  { reward: 75000, weight: 0.08 },
  { reward: 150000, weight: 0.05 }
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

function getDailyResetOffsetMinutes(): number {
  const raw = Number(process.env.DAILY_RESET_TZ_OFFSET_MINUTES || 0);
  if (!Number.isFinite(raw)) return 0;
  const n = Math.trunc(raw);
  return Math.max(-14 * 60, Math.min(14 * 60, n));
}

function dayKeyWithOffset(now: Date, offsetMinutes: number): string {
  const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  return dayKeyUtc(shifted);
}

function nextResetWithOffset(now: Date, offsetMinutes: number): Date {
  const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  const nextShiftedMidnight = nextMidnightUtc(shifted);
  return new Date(nextShiftedMidnight.getTime() - offsetMinutes * 60 * 1000);
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
  const raw = (doc as any)?.count;
  const n = typeof raw === 'number'
    ? raw
    : raw && typeof raw === 'object' && typeof (raw as any).toString === 'function'
      ? Number((raw as any).toString())
      : Number(raw);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 1;
}

function bonusBalanceFromDoc(doc: any): number {
  if (!doc) return 0;
  const raw = (doc as any)?.count;
  const n = typeof raw === 'number'
    ? raw
    : raw && typeof raw === 'object' && typeof (raw as any).toString === 'function'
      ? Number((raw as any).toString())
      : Number(raw);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 0;
}

async function getOrMigrateBonusBalance(db: any, steamId: string): Promise<number> {
  const bonusCol = db.collection('bonus_spins');
  const balanceDoc = await bonusCol.findOne({ _id: steamId } as any);
  if (balanceDoc) {
    const current = bonusBalanceFromDoc(balanceDoc);
    const raw = (balanceDoc as any)?.count;
    if (typeof raw !== 'number' && current >= 0) {
      try {
        await bonusCol.updateOne(
          { _id: steamId } as any,
          { $set: { count: current, updatedAt: new Date() } } as any
        );
      } catch {
      }
    }
    return current;
  }

  // Legacy migration: sum per-day bonus docs into a persistent balance.
  const legacyDocs = await bonusCol.find({ steamId, day: { $exists: true } } as any).toArray();
  const legacyTotal = (legacyDocs || []).reduce((sum: number, d: any) => sum + usedCountFromDoc(d), 0);
  const now = new Date();

  try {
    await bonusCol.updateOne(
      { _id: steamId } as any,
      {
        $setOnInsert: { _id: steamId, steamId, createdAt: now } as any,
        $set: { count: legacyTotal, updatedAt: now, migratedAt: now } as any,
      } as any,
      { upsert: true }
    );
  } catch {
    // ignore race
  }
  return legacyTotal;
}

async function consumeBonusSpin(db: any, steamId: string): Promise<number | null> {
  const bonusCol = db.collection('bonus_spins');
  const now = new Date();

  // Ensure a balance doc exists (and migrate legacy docs if needed)
  await getOrMigrateBonusBalance(db, steamId);

  const existing = await bonusCol.findOne({ _id: steamId } as any);
  const current = bonusBalanceFromDoc(existing);
  if (current < 1) {
    const legacyDocs = await bonusCol
      .find({ steamId, day: { $exists: true } } as any)
      .sort({ day: -1, updatedAt: -1, createdAt: -1 } as any)
      .limit(1)
      .toArray();

    const legacy = legacyDocs?.[0] || null;
    const legacyCurrent = usedCountFromDoc(legacy as any);
    if (!legacy || legacyCurrent < 1) return null;

    const next = Math.max(0, legacyCurrent - 1);
    await bonusCol.updateOne(
      { _id: (legacy as any)?._id } as any,
      { $set: { count: next, updatedAt: now } } as any
    );
    return next;
  }

  await bonusCol.updateOne(
    { _id: steamId } as any,
    {
      $setOnInsert: { _id: steamId, steamId, createdAt: now } as any,
      $set: { count: current - 1, updatedAt: now } as any,
    } as any,
    { upsert: true }
  );

  return current - 1;
}

function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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
  const resetOffsetMinutes = getDailyResetOffsetMinutes();
  const today = dayKeyWithOffset(now, resetOffsetMinutes);
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
  const bonusSpins = await getOrMigrateBonusBalance(db as any, steamId);
  const remainingSpins = Math.max(0, dailyLimit - usedSpins) + bonusSpins;
  const canSpin = remainingSpins > 0;
  const nextResetAt = nextResetWithOffset(now, resetOffsetMinutes);

  return NextResponse.json({
    canSpin,
    role,
    dailyLimit,
    usedSpins,
    remainingSpins,
    nextEligibleAt: canSpin ? now.toISOString() : nextResetAt.toISOString(),
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
  const resetOffsetMinutes = getDailyResetOffsetMinutes();
  const today = dayKeyWithOffset(now, resetOffsetMinutes);
  const spinKey = `${steamId}_${today}`;

  let usedBonus = false;

  if (dailyLimit !== null) {
    const existing = await spinsCol.findOne({ _id: spinKey });
    const used = usedCountFromDoc(existing);

    // If user already used their daily spins, require a persistent bonus spin.
    if (used >= dailyLimit) {
      const after = await consumeBonusSpin(db as any, steamId);
      if (after === null) {
        const nextResetAt = nextResetWithOffset(now, resetOffsetMinutes);
        return NextResponse.json(
          {
            error: 'Spin limit reached',
            dailyLimit,
            usedSpins: used,
            remainingSpins: 0,
            nextEligibleAt: nextResetAt.toISOString(),
          },
          { status: 400 }
        );
      }
      usedBonus = true;
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
    await historyCol.insertOne({ steamId, reward, createdAt: now, day: today, role, usedBonus });
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
