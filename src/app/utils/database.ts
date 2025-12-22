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

/**
 * Get value from database (KV primary, MongoDB fallback)
 */
export async function dbGet<T>(key: string): Promise<T | null> {
  // Try KV first
  if (await isKVAvailable()) {
    try {
      const value = await kv.get<T>(key);
      
      // Backup to MongoDB in background (don't wait)
      if (value && MONGODB_URI) {
        backupToMongoDB(key, value).catch(() => {});
      }
      
      dbStatus = 'kv';
      return value;
    } catch (error) {
      console.warn(`[Database] KV get failed for ${key}, trying MongoDB:`, error);
    }
  }

  // Fallback to MongoDB
  dbStatus = 'mongodb';
  const value = await mongoGet<T>(key);
  
  // If found in MongoDB and KV is available, try to sync back
  if (value && await isKVAvailable()) {
    syncFromMongoDBToKV(key).catch(() => {});
  }
  
  return value;
}

/**
 * Set value in database (write to both KV and MongoDB)
 */
export async function dbSet<T>(key: string, value: T): Promise<boolean> {
  let kvSuccess = false;
  let mongoSuccess = false;

  // Try KV first
  if (await isKVAvailable()) {
    try {
      await kv.set(key, value);
      kvSuccess = true;
      dbStatus = 'kv';
    } catch (error) {
      console.warn(`[Database] KV set failed for ${key}, will use MongoDB:`, error);
    }
  }

  // Always write to MongoDB as backup
  if (MONGODB_URI) {
    mongoSuccess = await mongoSet(key, value);
    if (mongoSuccess && !kvSuccess) {
      dbStatus = 'mongodb';
    }
  }

  return kvSuccess || mongoSuccess;
}

/**
 * Delete value from database
 */
export async function dbDelete(key: string): Promise<boolean> {
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
 * Check database health
 */
export async function checkDbHealth(): Promise<{
  kv: boolean;
  mongodb: boolean;
  status: 'kv' | 'mongodb' | 'fallback';
}> {
  const kvAvailable = await isKVAvailable();
  const mongoAvailable = MONGODB_URI ? (await initMongoDB()) !== null : false;

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

