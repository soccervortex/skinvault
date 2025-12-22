/**
 * Database Abstraction Layer
 * 
 * Primary: Vercel KV (Redis)
 * Fallback: MongoDB
 * 
 * Automatically switches to MongoDB when:
 * - KV is not configured
 * - KV hits rate limit
 * - KV connection fails
 * 
 * MongoDB also backs up KV data for redundancy
 */

import { kv } from '@vercel/kv';
import { MongoClient, Db, Collection } from 'mongodb';

// Database status
let dbStatus: 'kv' | 'mongodb' | 'fallback' = 'kv';
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

// Cache to reduce KV reads (simple in-memory cache)
const readCache: Map<string, { value: any; timestamp: number }> = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache
const MAX_CACHE_SIZE = 1000; // Max cached items

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

// Initialize MongoDB connection
async function initMongoDB(): Promise<Db | null> {
  if (!MONGODB_URI) {
    return null;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      mongoDb = mongoClient.db(MONGODB_DB_NAME);
      console.log('[Database] MongoDB connected successfully');
    }
    return mongoDb;
  } catch (error) {
    console.error('[Database] MongoDB connection failed:', error);
    return null;
  }
}

// Check if KV is available and working
async function isKVAvailable(): Promise<boolean> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return false;
  }

  try {
    // Try a simple read operation with timeout
    await Promise.race([
      kv.get('__health_check__'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('KV timeout')), 2000))
    ]);
    return true;
  } catch (error: any) {
    // Check for rate limit errors
    if (error?.message?.includes('rate limit') || 
        error?.message?.includes('429') ||
        error?.message?.includes('quota') ||
        error?.message?.includes('limit')) {
      console.warn('[Database] KV rate limit hit, switching to MongoDB');
      return false;
    }
    console.warn('[Database] KV unavailable:', error?.message);
    return false;
  }
}

// Get MongoDB collection for a key
async function getMongoCollection(key: string): Promise<Collection | null> {
  const db = await initMongoDB();
  if (!db) return null;
  
  // Use a single collection for all KV-like data
  return db.collection('kv_data');
}

// MongoDB operations
async function mongoGet<T>(key: string): Promise<T | null> {
  try {
    const collection = await getMongoCollection(key);
    if (!collection) return null;

    const doc = await collection.findOne({ key });
    return doc ? (doc.value as T) : null;
  } catch (error) {
    console.error(`[Database] MongoDB get failed for key ${key}:`, error);
    return null;
  }
}

async function mongoSet<T>(key: string, value: T): Promise<boolean> {
  try {
    const collection = await getMongoCollection(key);
    if (!collection) return false;

    await collection.updateOne(
      { key },
      { $set: { key, value, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error(`[Database] MongoDB set failed for key ${key}:`, error);
    return false;
  }
}

async function mongoDelete(key: string): Promise<boolean> {
  try {
    const collection = await getMongoCollection(key);
    if (!collection) return false;

    await collection.deleteOne({ key });
    return true;
  } catch (error) {
    console.error(`[Database] MongoDB delete failed for key ${key}:`, error);
    return false;
  }
}

// Backup KV data to MongoDB
async function backupToMongoDB(key: string, value: any): Promise<void> {
  try {
    const collection = await getMongoCollection(key);
    if (!collection) return;

    await collection.updateOne(
      { key, source: 'kv_backup' },
      { 
        $set: { 
          key, 
          value, 
          source: 'kv_backup',
          backedUpAt: new Date() 
        } 
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[Database] Backup to MongoDB failed for key ${key}:`, error);
  }
}

// Sync from MongoDB to KV (when KV becomes available again)
async function syncFromMongoDBToKV(key: string): Promise<void> {
  try {
    const value = await mongoGet(key);
    if (value && await isKVAvailable()) {
      await kv.set(key, value);
      console.log(`[Database] Synced ${key} from MongoDB to KV`);
    }
  } catch (error) {
    console.error(`[Database] Sync from MongoDB to KV failed for key ${key}:`, error);
  }
}

// Sync all MongoDB data back to KV (when KV recovers)
async function syncAllFromMongoDBToKV(): Promise<void> {
  if (!await isKVAvailable()) {
    return; // KV not available yet
  }

  try {
    const collection = await getMongoCollection('__all_keys__');
    if (!collection) return;

    // Get all keys from MongoDB
    const allDocs = await collection.find({}).toArray();
    let synced = 0;
    let failed = 0;

    for (const doc of allDocs) {
      try {
        // Skip backup markers
        if (doc.source === 'kv_backup') continue;
        
        await kv.set(doc.key, doc.value);
        synced++;
      } catch (error) {
        console.error(`[Database] Failed to sync key ${doc.key} to KV:`, error);
        failed++;
      }
    }

    console.log(`[Database] Sync complete: ${synced} keys synced, ${failed} failed`);
  } catch (error) {
    console.error('[Database] Failed to sync all data from MongoDB to KV:', error);
  }
}

/**
 * Get value from database (with caching to reduce KV reads)
 */
export async function dbGet<T>(key: string, useCache: boolean = true): Promise<T | null> {
  // Check cache first (reduces KV reads)
  if (useCache) {
    const cached = readCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value as T;
    }
  }

  // Try KV first
  if (await isKVAvailable()) {
    try {
      const value = await kv.get<T>(key);
      
      // Update cache
      if (useCache && value !== null) {
        // Clean cache if too large
        if (readCache.size >= MAX_CACHE_SIZE) {
          const firstKey = readCache.keys().next().value;
          readCache.delete(firstKey);
        }
        readCache.set(key, { value, timestamp: Date.now() });
      }
      
      // If found in KV, ensure MongoDB also has it (sync in background)
      if (value && MONGODB_URI) {
        mongoSet(key, value).catch(() => {}); // Sync to MongoDB
      }
      
      dbStatus = 'kv';
      return value;
    } catch (error) {
      console.warn(`[Database] KV get failed for ${key}, trying MongoDB:`, error);
      readCache.delete(key); // Remove from cache on error
    }
  }

  // Fallback to MongoDB
  dbStatus = 'mongodb';
  const value = await mongoGet<T>(key);
  
  // Update cache
  if (useCache && value !== null) {
    if (readCache.size >= MAX_CACHE_SIZE) {
      const firstKey = readCache.keys().next().value;
      readCache.delete(firstKey);
    }
    readCache.set(key, { value, timestamp: Date.now() });
  }
  
  // If found in MongoDB and KV is available, sync back to KV immediately
  if (value && await isKVAvailable()) {
    // Sync back to KV so both databases have the data
    try {
      await kv.set(key, value);
      console.log(`[Database] Synced ${key} from MongoDB to KV (read recovery)`);
    } catch (error) {
      console.warn(`[Database] Failed to sync ${key} back to KV:`, error);
    }
  }
  
  return value;
}

/**
 * Set value in database (ALWAYS write to both KV and MongoDB for sync)
 */
export async function dbSet<T>(key: string, value: T): Promise<boolean> {
  // Update cache immediately (reduces future KV reads)
  readCache.set(key, { value, timestamp: Date.now() });
  if (readCache.size > MAX_CACHE_SIZE) {
    const firstKey = readCache.keys().next().value;
    readCache.delete(firstKey);
  }

  let kvSuccess = false;
  let mongoSuccess = false;

  // Always try to write to both databases for sync
  const writePromises: Promise<void>[] = [];

  // Write to KV (if available)
  if (await isKVAvailable()) {
    writePromises.push(
      kv.set(key, value)
        .then(() => {
          kvSuccess = true;
          dbStatus = 'kv';
        })
        .catch((error) => {
          console.warn(`[Database] KV set failed for ${key}:`, error);
        })
    );
  }

  // ALWAYS write to MongoDB (even if KV fails)
  if (MONGODB_URI) {
    writePromises.push(
      mongoSet(key, value)
        .then(() => {
          mongoSuccess = true;
          if (!kvSuccess) {
            dbStatus = 'mongodb';
          }
        })
        .catch((error) => {
          console.error(`[Database] MongoDB set failed for ${key}:`, error);
        })
    );
  }

  // Wait for both writes (don't fail if one fails)
  await Promise.allSettled(writePromises);

  // If KV failed but MongoDB succeeded, try to sync back to KV later
  if (!kvSuccess && mongoSuccess && await isKVAvailable()) {
    // Try to sync immediately (don't wait, do in background)
    syncFromMongoDBToKV(key).catch(() => {});
  }

  return kvSuccess || mongoSuccess;
}

/**
 * Delete value from database
 */
export async function dbDelete(key: string): Promise<boolean> {
  // Remove from cache
  readCache.delete(key);

  let kvSuccess = false;
  let mongoSuccess = false;

  // Try KV first
  if (await isKVAvailable()) {
    try {
      await kv.del(key);
      kvSuccess = true;
    } catch (error) {
      console.warn(`[Database] KV delete failed for ${key}:`, error);
    }
  }

  // Also delete from MongoDB
  if (MONGODB_URI) {
    mongoSuccess = await mongoDelete(key);
  }

  return kvSuccess || mongoSuccess;
}

/**
 * Get current database status
 */
export function getDbStatus(): 'kv' | 'mongodb' | 'fallback' {
  return dbStatus;
}

/**
 * Sync all data from MongoDB to KV (call this when KV recovers)
 */
export async function syncAllDataToKV(): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  if (!await isKVAvailable()) {
    return { synced: 0, failed: 0, total: 0 };
  }

  try {
    const collection = await getMongoCollection('__all_keys__');
    if (!collection) {
      return { synced: 0, failed: 0, total: 0 };
    }

    // Get all keys from MongoDB
    const allDocs = await collection.find({}).toArray();
    let synced = 0;
    let failed = 0;

    for (const doc of allDocs) {
      try {
        // Skip backup markers and internal keys
        if (doc.source === 'kv_backup' || doc.key?.startsWith('__')) continue;
        
        await kv.set(doc.key, doc.value);
        synced++;
      } catch (error) {
        console.error(`[Database] Failed to sync key ${doc.key} to KV:`, error);
        failed++;
      }
    }

    console.log(`[Database] Full sync complete: ${synced} keys synced, ${failed} failed, ${allDocs.length} total`);
    return { synced, failed, total: allDocs.length };
  } catch (error) {
    console.error('[Database] Failed to sync all data from MongoDB to KV:', error);
    return { synced: 0, failed: 0, total: 0 };
  }
}

/**
 * Check database health
 */
export async function checkDbHealth(): Promise<{
  kv: boolean;
  mongodb: boolean;
  status: 'kv' | 'mongodb' | 'fallback';
}> {
  const kvAvailable = await isKVAvailable();
  const mongoAvailable = MONGODB_URI ? (await initMongoDB()) !== null : false;

  // If KV just became available and we were using MongoDB, trigger sync
  if (kvAvailable && dbStatus === 'mongodb' && mongoAvailable) {
    console.log('[Database] KV recovered, syncing data from MongoDB...');
    syncAllDataToKV().catch(() => {});
  }

  return {
    kv: kvAvailable,
    mongodb: mongoAvailable,
    status: kvAvailable ? 'kv' : (mongoAvailable ? 'mongodb' : 'fallback'),
  };
}

/**
 * Close database connections (for cleanup)
 */
export async function closeDbConnections(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
}

