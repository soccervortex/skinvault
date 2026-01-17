/**
 * MongoDB Connection Pool
 * Reuse connections instead of creating new ones for each request
 * This dramatically improves performance
 */

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_CHAT_URI = process.env.MONGODB_CHAT_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

function getCoreMongoUriCandidates(): string[] {
  const candidates: string[] = [];
  const c1 = String((process.env as any).MONGODB_CLUSTER_1 || '').trim();
  if (c1) candidates.push(c1);
  if (MONGODB_URI && String(MONGODB_URI).trim()) candidates.push(String(MONGODB_URI).trim());
  return Array.from(new Set(candidates));
}

function getChatMongoUriCandidates(): string[] {
  const candidates: string[] = [];

  const clusterEntries = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('MONGODB_CLUSTER_') && value && String(value).trim())
    .map(([key, value]) => {
      const rawIdx = key.slice('MONGODB_CLUSTER_'.length);
      const idx = Number.parseInt(rawIdx, 10);
      return {
        key,
        idx: Number.isFinite(idx) ? idx : Number.POSITIVE_INFINITY,
        uri: String(value).trim(),
      };
    })
    .filter((e) => e.idx >= 2)
    .sort((a, b) => {
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.key.localeCompare(b.key);
    });

  for (const entry of clusterEntries) {
    candidates.push(entry.uri);
  }

  if (MONGODB_CHAT_URI && String(MONGODB_CHAT_URI).trim()) candidates.push(String(MONGODB_CHAT_URI).trim());

  return Array.from(new Set(candidates));
}

export function getMongoUriCandidates(): string[] {
  return getCoreMongoUriCandidates();
}

export function hasMongoConfig(): boolean {
  return getCoreMongoUriCandidates().length > 0;
}

export function hasChatMongoConfig(): boolean {
  return getChatMongoUriCandidates().length > 0;
}

// Global connection pool
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let cachedUri: string | null = null;
let lastGoodUriIndex: number = 0;

let cachedChatClient: MongoClient | null = null;
let cachedChatDb: Db | null = null;
let cachedChatUri: string | null = null;
let lastGoodChatUriIndex: number = 0;

export function getCachedMongoUri(): string | null {
  return cachedUri;
}

export function getCachedChatMongoUri(): string | null {
  return cachedChatUri;
}

/**
 * Get or create MongoDB client (connection pooling)
 * Reuses existing connection instead of creating new ones
 */
export async function getMongoClient(): Promise<MongoClient> {
  const candidates = getCoreMongoUriCandidates();
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

      try {
        const { setupCoreIndexes } = await import('./mongodb-auto-index');
        setupCoreIndexes(client.db(MONGODB_DB_NAME)).catch(() => {});
      } catch (e: any) {
        console.warn('MongoDB index auto-setup skipped', { name: e?.name, message: e?.message });
      }
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

  return cachedClient;
}

export async function getChatMongoClient(): Promise<MongoClient> {
  const candidates = getChatMongoUriCandidates();
  if (candidates.length === 0) throw new Error('Chat MongoDB URI not configured');

  if (cachedChatClient) {
    try {
      await cachedChatClient.db('admin').command({ ping: 1 });
      return cachedChatClient;
    } catch {
      cachedChatClient = null;
      cachedChatDb = null;
      cachedChatUri = null;
    }
  }

  const startIndex = Math.min(Math.max(lastGoodChatUriIndex, 0), Math.max(candidates.length - 1, 0));
  const ordered = [...candidates.slice(startIndex), ...candidates.slice(0, startIndex)];

  let lastError: any = null;
  for (let i = 0; i < ordered.length; i++) {
    const uri = ordered[i];
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      maxPoolSize: 5,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      socketTimeoutMS: 45000,
    });

    try {
      await client.connect();
      cachedChatClient = client;
      cachedChatUri = uri;
      lastGoodChatUriIndex = candidates.indexOf(uri);

      try {
        const { setupChatAndCacheIndexes } = await import('./mongodb-auto-index');
        setupChatAndCacheIndexes(client.db(MONGODB_DB_NAME)).catch(() => {});
      } catch (e: any) {
        console.warn('MongoDB index auto-setup skipped', { name: e?.name, message: e?.message });
      }
      break;
    } catch (e: any) {
      lastError = e;
      try {
        await client.close();
      } catch {
      }
    }
  }

  if (!cachedChatClient) {
    throw lastError || new Error('Chat MongoDB connection failed');
  }

  return cachedChatClient;
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

export async function getChatDatabase(): Promise<Db> {
  if (cachedChatDb) {
    return cachedChatDb;
  }

  const client = await getChatMongoClient();
  cachedChatDb = client.db(MONGODB_DB_NAME);
  return cachedChatDb;
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

  if (cachedChatClient) {
    await cachedChatClient.close();
    cachedChatClient = null;
    cachedChatDb = null;
  }
}

