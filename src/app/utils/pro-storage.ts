import { getCollection, executeWithFailover } from './mongodb';

const OWNER_STEAM_ID = '76561199235618867';
const COLLECTION_NAME = 'pro_users';

interface ProUserDocument {
  _id: string; // steamId
  proUntil: string; // ISO date string
  updatedAt: Date;
}

async function readProData(): Promise<Record<string, string>> {
  try {
    const collection = await getCollection<ProUserDocument>(COLLECTION_NAME);
    const docs = await collection.find({}).toArray();
    
    const result: Record<string, string> = {};
    for (const doc of docs) {
      result[doc._id] = doc.proUntil;
    }
    
    return result;
  } catch (error) {
    console.error('MongoDB read failed:', error);
    return {};
  }
}

async function readSingleProData(steamId: string): Promise<string | null> {
  try {
    const collection = await getCollection<ProUserDocument>(COLLECTION_NAME);
    const doc = await collection.findOne({ _id: steamId });
    return doc?.proUntil || null;
  } catch (error) {
    console.error('MongoDB read single failed:', error);
    return null;
  }
}

export async function writeProData(data: Record<string, string>): Promise<void> {
  try {
    const collection = await getCollection<ProUserDocument>(COLLECTION_NAME);
    
    // Use bulk write for efficiency
    const operations = Object.entries(data).map(([steamId, proUntil]) => ({
      updateOne: {
        filter: { _id: steamId },
        update: {
          $set: {
            _id: steamId,
            proUntil,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));
    
    if (operations.length > 0) {
      await collection.bulkWrite(operations);
    }
  } catch (error) {
    console.error('MongoDB write failed:', error);
    throw error;
  }
}

export async function getProUntil(steamId: string): Promise<string | null> {
  let proUntil = await readSingleProData(steamId);

  // Owner account has Pro forever
  if (steamId === OWNER_STEAM_ID && !proUntil) {
    proUntil = '2999-01-01T00:00:00.000Z';
  }

  return proUntil;
}

export async function grantPro(steamId: string, months: number): Promise<string> {
  const now = new Date();
  const existing = await readSingleProData(steamId);
  const existingDate = existing ? new Date(existing) : null;
  const base = existingDate && existingDate > now ? existingDate : now;

  const newDate = new Date(base);
  newDate.setMonth(newDate.getMonth() + months);
  const proUntil = newDate.toISOString();

  // Write single record
  const collection = await getCollection<ProUserDocument>(COLLECTION_NAME);
  await collection.updateOne(
    { _id: steamId },
    {
      $set: {
        _id: steamId,
        proUntil,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return proUntil;
}

export async function getAllProUsers(): Promise<Record<string, string>> {
  return await readProData();
}
