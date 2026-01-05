/**
 * MongoDB Connection Pool
 * Reuse connections instead of creating new ones for each request
 * This dramatically improves performance
 */

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

function getMongoUriCandidates(): string[] {
  const candidates: string[] = [];

  for (let i = 1; i <= 5; i++) {
    const v = (process.env as any)[`MONGODB_CLUSTER_${i}`];
    if (v && String(v).trim()) candidates.push(String(v).trim());
  }

  if (MONGODB_URI && String(MONGODB_URI).trim()) candidates.push(String(MONGODB_URI).trim());

  // De-duplicate while preserving order
  return Array.from(new Set(candidates));
}

export function hasMongoConfig(): boolean {
  return getMongoUriCandidates().length > 0;
}

// Global connection pool
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let cachedUri: string | null = null;
let lastGoodUriIndex: number = 0;

/**
 * Get or create MongoDB client (connection pooling)
 * Reuses existing connection instead of creating new ones
 */
export async function getMongoClient(): Promise<MongoClient> {
  const candidates = getMongoUriCandidates();
  if (candidates.length === 0) throw new Error('MongoDB URI not configured');

  // Return cached client if available and connected
  if (cachedClient) {
    try {
      // Ping to check if connection is still alive
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch (error) {
      // Connection is dead, create new one
      cachedClient = null;
      cachedDb = null;
      cachedUri = null;
    }
  }

  // Create new client with connection pooling settings
  // Reduced pool size for M0 cluster (500 connection limit)
  const startIndex = Math.min(Math.max(lastGoodUriIndex, 0), Math.max(candidates.length - 1, 0));
  const ordered = [...candidates.slice(startIndex), ...candidates.slice(0, startIndex)];

  let lastError: any = null;
  for (let i = 0; i < ordered.length; i++) {
    const uri = ordered[i];
    const client = new MongoClient(uri, {
      // Vercel/Serverless can be slow to establish TLS + DNS; allow a bit more time.
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      maxPoolSize: 5,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      socketTimeoutMS: 45000,
    });

    try {
      await client.connect();
      cachedClient = client;
      cachedUri = uri;
      lastGoodUriIndex = candidates.indexOf(uri);
      break;
    } catch (e: any) {
      lastError = e;
      try {
        await client.close();
      } catch {
        // ignore
      }
    }
  }

  if (!cachedClient) {
    throw lastError || new Error('MongoDB connection failed');
  }

  // Auto-setup indexes on first connection
  const { autoSetupIndexes } = await import('@/app/utils/mongodb-auto-index');
  autoSetupIndexes().catch(() => {});

  return cachedClient;
}

/**
 * Get database instance (cached)
 */
export async function getDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await getMongoClient();
  cachedDb = client.db(MONGODB_DB_NAME);
  return cachedDb;
}

/**
 * Close connection (for cleanup/testing)
 */
export async function closeConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}

