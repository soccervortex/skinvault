import { getCollection } from './mongodb';
import { Document } from 'mongodb';

const OWNER_STEAM_ID = '76561199235618867';
const COLLECTION_NAME = 'prime_users';

interface PrimeUserDocument extends Document {
  _id: string; // steamId
  primeUntil: string; // ISO date string
  updatedAt: Date;
}

async function readSinglePrimeData(steamId: string): Promise<string | null> {
  try {
    const collection = await getCollection<PrimeUserDocument>(COLLECTION_NAME);
    const doc = await collection.findOne({ _id: steamId });
    return doc?.primeUntil || null;
  } catch (error) {
    console.error('MongoDB read single prime failed:', error);
    return null;
  }
}

export async function getPrimeUntil(steamId: string): Promise<string | null> {
  let primeUntil = await readSinglePrimeData(steamId);

  // Owner account has Prime forever
  if (steamId === OWNER_STEAM_ID && !primeUntil) {
    primeUntil = '2999-01-01T00:00:00.000Z';
  }

  return primeUntil;
}

export async function grantPrime(steamId: string, months: number): Promise<string> {
  const now = new Date();
  const existing = await readSinglePrimeData(steamId);
  const existingDate = existing ? new Date(existing) : null;
  const base = existingDate && existingDate > now ? existingDate : now;

  const newDate = new Date(base);
  newDate.setMonth(newDate.getMonth() + months);
  const primeUntil = newDate.toISOString();

  // Write single record
  const collection = await getCollection<PrimeUserDocument>(COLLECTION_NAME);
  await collection.updateOne(
    { _id: steamId },
    {
      $set: {
        _id: steamId,
        primeUntil,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return primeUntil;
}

export async function getAllPrimeUsers(): Promise<Record<string, string>> {
  try {
    const collection = await getCollection<PrimeUserDocument>(COLLECTION_NAME);
    const docs = await collection.find({}).toArray();
    
    const result: Record<string, string> = {};
    for (const doc of docs) {
      result[doc._id] = doc.primeUntil;
    }
    
    return result;
  } catch (error) {
    console.error('MongoDB read prime failed:', error);
    return {};
  }
}

