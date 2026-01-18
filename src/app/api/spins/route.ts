import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

// --- Types ---
type DailySpinDoc = {
  _id: string; // composite key: steamId_day
  steamId: string;
  day: string;
  createdAt: Date;
};

type UserCreditsDoc = {
  _id: string; // steamId
  steamId: string;
  balance: number;
  updatedAt: Date;
};

// --- Reward Logic ---
const REWARDS = [
  { reward: 10, weight: 50 },
  { reward: 25, weight: 30 },
  { reward: 50, weight: 15 },
  { reward: 100, weight: 4 },
  { reward: 500, weight: 0.9 },
  { reward: 1000, weight: 0.1 }
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

// --- API Handlers ---
export async function GET(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const db = await getDatabase();
  const spinsCol = db.collection<DailySpinDoc>('daily_spins');
  const now = new Date();
  const today = dayKeyUtc(now);
  const spinKey = `${steamId}_${today}`;

  const alreadySpun = await spinsCol.findOne({ _id: spinKey });
  const canSpin = !alreadySpun;

  return NextResponse.json({
    canSpin,
    nextEligibleAt: canSpin ? now.toISOString() : nextMidnightUtc(now).toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasMongoConfig()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const db = await getDatabase();
  const spinsCol = db.collection<DailySpinDoc>('daily_spins');
  const creditsCol = db.collection<UserCreditsDoc>('user_credits');
  const now = new Date();
  const today = dayKeyUtc(now);
  const spinKey = `${steamId}_${today}`;

  try {
    await spinsCol.insertOne({ _id: spinKey, steamId, day: today, createdAt: now });
  } catch (e: any) {
    if (e?.code === 11000) {
      return NextResponse.json({ error: 'Already spun today' }, { status: 400 });
    }
    throw e;
  }

  const reward = getWeightedReward();

  const updatedDoc = await creditsCol.findOneAndUpdate(
    { _id: steamId },
    {
      $inc: { balance: reward },
      $set: { updatedAt: now },
      $setOnInsert: { _id: steamId, steamId }
    },
    { upsert: true, returnDocument: 'after' }
  );

  return NextResponse.json({
    reward,
    newBalance: updatedDoc?.balance || 0,
  });
}
