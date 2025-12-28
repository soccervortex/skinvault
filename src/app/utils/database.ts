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
import { getMongoClient, getDatabase as getSharedDatabase } from './mongodb-client';

// Database status
let dbStatus: 'kv' | 'mongodb' | 'fallback' = 'kv';
let previousKVAvailable: boolean | null = null; // Track KV availability to detect recovery

// Cache to reduce KV reads (simple in-memory cache)
const readCache: Map<string, { value: any; timestamp: number }> = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache
const MAX_CACHE_SIZE = 1000; // Max cached items

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

// Initialize MongoDB connection using shared connection pool
async function initMongoDB(): Promise<Db | null> {
  if (!MONGODB_URI) {
    console.warn('[Database] ⚠️ MONGODB_URI not configured');
    return null;
  }

  try {
    // Use shared connection pool instead of creating new client
    const db = await getSharedDatabase();
    console.log('[Database] ✅ Using shared MongoDB connection pool');
    return db;
  } catch (error) {
    console.error('[Database] ❌ MongoDB connection failed:', error);
    return null;
  }
}

// Check if KV is available and working
async function isKVAvailable(): Promise<boolean> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    previousKVAvailable = false;
    return false;
  }

  try {
    // Try a simple read operation with timeout
    await Promise.race([
      kv.get('__health_check__'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('KV timeout')), 2000))
    ]);
    
    // Check if KV just recovered (was unavailable, now available)
    const justRecovered = previousKVAvailable === false;
    previousKVAvailable = true;
    
    if (justRecovered && dbStatus === 'mongodb') {
      console.log('[Database] ✅ KV recovered! Triggering full sync from MongoDB to KV...');
      // Trigger full sync in background (don't block)
      syncAllDataToKV().catch((err) => {
        console.error('[Database] Full sync failed:', err);
      });
      dbStatus = 'kv'; // Update status since KV is now available
    }
    
    return true;
  } catch (error: any) {
    previousKVAvailable = false;
    
    // Check for rate limit errors (multiple patterns)
    const errorMsg = error?.message?.toLowerCase() || '';
    const errorString = JSON.stringify(error).toLowerCase();
    
    if (errorMsg.includes('rate limit') || 
        errorMsg.includes('429') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('limit') ||
        errorMsg.includes('too many requests') ||
        errorString.includes('rate limit') ||
        errorString.includes('429') ||
        errorString.includes('quota exceeded') ||
        error?.status === 429 ||
        error?.statusCode === 429) {
      console.warn('[Database] ⚠️ KV rate limit hit, switching to MongoDB');
      dbStatus = 'mongodb';
      return false;
    }
    console.warn('[Database] ⚠️ KV unavailable:', error?.message || error);
    return false;
  }
}

// Get MongoDB collection for a key
// Each KV key becomes its own MongoDB collection for easier browsing
async function getMongoCollection(key: string): Promise<Collection | null> {
  const db = await initMongoDB();
  if (!db) return null;

  // Sanitize key name for MongoDB collection name (must be valid collection name)
  // Replace invalid characters with underscores
  const collectionName = key.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Use the key name as the collection name (makes it identical to KV structure)
  return db.collection(collectionName);
}

// MongoDB operations
// Each collection stores a single document with the value
// Structure: { _id: key, value: <actual data>, updatedAt: Date }
async function mongoGet<T>(key: string): Promise<T | null> {
  try {
    const collection = await getMongoCollection(key);
    if (!collection) return null;

    // Each collection has a single document with _id = key
    const doc = await collection.findOne({ _id: key } as any);
    return doc ? (doc.value as T) : null;
  } catch (error) {
    console.error(`[Database] MongoDB get failed for key ${key}:`, error);
    return null;
  }
}

async function mongoSet<T>(key: string, value: T): Promise<boolean> {
  try {
    const collection = await getMongoCollection(key);
    if (!collection) {
      console.error(`[Database] ❌ Failed to get MongoDB collection for key ${key}`);
      return false;
    }

    // Store as single document with _id = key, value = actual data
    const result = await collection.updateOne(
      { _id: key } as any,
      { 
        $set: { 
          _id: key, 
          value, 
          updatedAt: new Date(),
          source: 'db_set'
        } 
      },
      { upsert: true }
    );
    
    if (result.acknowledged) {
      const action = result.upsertedCount > 0 ? 'created' : (result.modifiedCount > 0 ? 'updated' : 'no change');
      console.log(`[Database] ✅ MongoDB write acknowledged for ${key} (${action}, matched: ${result.matchedCount}, modified: ${result.modifiedCount}, upserted: ${result.upsertedCount})`);
      
      // Verify the write by reading it back
      try {
        const verify = await collection.findOne({ _id: key } as any);
        if (verify && JSON.stringify(verify.value) === JSON.stringify(value)) {
          console.log(`[Database] ✅ Verified MongoDB write for ${key}`);
        } else {
          console.warn(`[Database] ⚠️ MongoDB write verification failed for ${key}`);
        }
      } catch (verifyError) {
        console.warn(`[Database] ⚠️ Could not verify MongoDB write for ${key}:`, verifyError);
      }
      
      return true;
    } else {
      console.error(`[Database] ❌ MongoDB write not acknowledged for ${key}`);
      return false;
    }
  } catch (error: any) {
    console.error(`[Database] ❌ MongoDB set failed for key ${key}:`, error?.message || error);
    return false;
  }
}

async function mongoDelete(key: string): Promise<boolean> {
  try {
    const collection = await getMongoCollection(key);
    if (!collection) return false;

    await collection.deleteOne({ _id: key } as any);
    return true;
  } catch (error) {
    console.error(`[Database] MongoDB delete failed for key ${key}:`, error);
    return false;
  }
}

// Backup KV data to MongoDB (no longer needed - dbSet handles this)
async function backupToMongoDB(key: string, value: any): Promise<void> {
  // This function is kept for backwards compatibility but dbSet already handles backups
  // No-op since dbSet always writes to both KV and MongoDB
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
          if (firstKey) readCache.delete(firstKey);
        }
        readCache.set(key, { value, timestamp: Date.now() });
      }
      
      // If found in KV, ensure MongoDB also has it (sync in background)
      if (value && MONGODB_URI) {
        mongoSet(key, value).catch(() => {}); // Sync to MongoDB
      }
      
      dbStatus = 'kv';
      return value;
    } catch (error: any) {
      // Check if it's a rate limit error
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('rate limit') || errorMsg.includes('429') || errorMsg.includes('quota')) {
        console.warn(`[Database] ⚠️ KV rate limit hit during read for ${key}, falling back to MongoDB`);
        dbStatus = 'mongodb';
      } else {
        console.warn(`[Database] ⚠️ KV get failed for ${key}, trying MongoDB:`, error?.message || error);
      }
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
      if (firstKey) readCache.delete(firstKey);
    }
    readCache.set(key, { value, timestamp: Date.now() });
  }
  
  // If found in MongoDB and KV is available, sync back to KV immediately
  if (value && await isKVAvailable()) {
    // Sync back to KV so both databases have the data
    try {
      await kv.set(key, value);
      console.log(`[Database] Synced ${key} from MongoDB to KV (read recovery)`);
      
      // If we were using MongoDB and KV just became available, trigger full sync
      if (dbStatus === 'mongodb') {
        console.log('[Database] KV recovered during read, triggering full sync from MongoDB...');
        syncAllDataToKV().catch(() => {});
        dbStatus = 'kv'; // Update status since KV is now available
      }
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
  // Clear cache for this key first to ensure fresh read after write
  readCache.delete(key);
  
  // Update cache immediately with new value (reduces future KV reads)
  readCache.set(key, { value, timestamp: Date.now() });
  if (readCache.size > MAX_CACHE_SIZE) {
    const firstKey = readCache.keys().next().value;
    if (firstKey) readCache.delete(firstKey);
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
        .catch((error: any) => {
          // Check if it's a rate limit error
          const errorMsg = error?.message?.toLowerCase() || '';
          if (errorMsg.includes('rate limit') || errorMsg.includes('429') || errorMsg.includes('quota')) {
            console.warn(`[Database] ⚠️ KV rate limit hit during write for ${key}, MongoDB will handle it`);
            dbStatus = 'mongodb';
          } else {
            console.warn(`[Database] ⚠️ KV set failed for ${key}:`, error?.message || error);
          }
        })
    );
  }

  // ALWAYS write to MongoDB (even if KV fails)
  if (MONGODB_URI) {
    writePromises.push(
      mongoSet(key, value)
        .then((success) => {
          if (success) {
            mongoSuccess = true;
            if (!kvSuccess) {
              dbStatus = 'mongodb';
            }
          } else {
            console.error(`[Database] ❌ MongoDB write returned false for ${key} (check connection)`);
          }
        })
        .catch((error) => {
          console.error(`[Database] ❌ MongoDB set failed for ${key}:`, error);
        })
    );
  } else {
    console.warn(`[Database] ⚠️ MONGODB_URI not configured, skipping MongoDB write for ${key}`);
  }

  // Wait for both writes (don't fail if one fails)
  const results = await Promise.allSettled(writePromises);
  
  // Log summary (handle cases where only one write promise exists)
  const kvResult = writePromises.length > 0 && results[0]?.status === 'fulfilled' ? '✅' : (writePromises.length > 0 && results[0]?.status === 'rejected' ? '❌' : '⏭️');
  const mongoResult = writePromises.length > 1 && results[1]?.status === 'fulfilled' ? '✅' : (writePromises.length > 1 && results[1]?.status === 'rejected' ? '❌' : (MONGODB_URI ? '⏭️' : '🚫'));
  console.log(`[Database] Write summary for ${key}: KV ${kvResult} | MongoDB ${mongoResult}`);

  // If KV failed but MongoDB succeeded, try to sync back to KV when it recovers
  if (!kvSuccess && mongoSuccess) {
    // Check if KV just became available (recovered from rate limit/outage)
    const kvNowAvailable = await isKVAvailable();
    if (kvNowAvailable) {
      // KV recovered! Sync this key immediately, then trigger full sync
      syncFromMongoDBToKV(key).catch(() => {});
      // Also trigger full sync in background (to catch any other keys that were written while KV was down)
      if (dbStatus === 'mongodb') {
        console.log('[Database] KV recovered during write, triggering full sync from MongoDB...');
        syncAllDataToKV().catch(() => {});
        dbStatus = 'kv'; // Update status since KV is now available
      }
    }
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
  details?: Array<{ key: string; status: 'success' | 'failed' | 'skipped'; error?: string }>;
}> {
  if (!await isKVAvailable()) {
    console.warn('[Database] ⚠️ KV not available, cannot sync');
    return { synced: 0, failed: 0, total: 0, details: [] };
  }

  const db = await initMongoDB();
  if (!db) {
    console.warn('[Database] ⚠️ MongoDB not available, cannot sync');
    return { synced: 0, failed: 0, total: 0, details: [] };
  }

  try {
    console.log('[Database] 🔄 Starting full sync from MongoDB to KV...');
    // Get all collections (each collection = one KV key)
    const collections = await db.listCollections().toArray();
    let synced = 0;
    let failed = 0;
    const details: Array<{ key: string; status: 'success' | 'failed' | 'skipped'; error?: string }> = [];

    for (const collInfo of collections) {
      const collectionName = collInfo.name;
      // Skip system collections
      if (collectionName.startsWith('system.') || collectionName.startsWith('__')) {
        details.push({ key: collectionName, status: 'skipped' });
        continue;
      }

      try {
        const collection = db.collection(collectionName);
        const doc = await collection.findOne({ _id: collectionName } as any);
        
        if (doc && doc.value !== undefined) {
          // Compare with KV to see if sync is needed
          const kvValue = await kv.get(collectionName);
          const kvString = JSON.stringify(kvValue);
          const mongoString = JSON.stringify(doc.value);
          
          if (kvString !== mongoString) {
            await kv.set(collectionName, doc.value);
            synced++;
            details.push({ key: collectionName, status: 'success' });
            console.log(`[Database] ✅ Synced ${collectionName} from MongoDB to KV`);
          } else {
            details.push({ key: collectionName, status: 'skipped' });
            console.log(`[Database] ⏭️  ${collectionName} already in sync`);
          }
        } else {
          details.push({ key: collectionName, status: 'skipped' });
        }
      } catch (error: any) {
        console.error(`[Database] ❌ Failed to sync collection ${collectionName} to KV:`, error);
        failed++;
        details.push({ key: collectionName, status: 'failed', error: error?.message || 'Unknown error' });
      }
    }

    console.log(`[Database] ✅ Full sync complete: ${synced} keys synced, ${failed} failed, ${collections.length} total`);
    return { synced, failed, total: collections.length, details };
  } catch (error) {
    console.error('[Database] ❌ Failed to sync all data from MongoDB to KV:', error);
    return { synced: 0, failed: 0, total: 0, details: [] };
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
 * Uses shared connection pool from mongodb-client
 */
export async function closeDbConnections(): Promise<void> {
  try {
    const { closeConnection } = await import('@/app/utils/mongodb-client');
    await closeConnection();
  } catch (error) {
    // Ignore errors - connection pool manages itself
  }
}

/**
 * Server-side helper to check for discord_access reward directly from KV/MongoDB.
 * Used in API routes to avoid client-side API calls.
 */
export async function hasDiscordAccessServer(steamId: string): Promise<boolean> {
  const rewardsKey = 'user_rewards';
  const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey, false) || {}; // No cache for this specific check
  const userRewards = existingRewards[steamId] || [];
  return userRewards.some((reward: any) => reward?.type === 'discord_access');
}

