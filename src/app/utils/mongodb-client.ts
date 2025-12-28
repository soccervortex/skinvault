/**
 * MongoDB Connection Pool
 * Reuse connections instead of creating new ones for each request
 * This dramatically improves performance
 */

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

// Global connection pool
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * Get or create MongoDB client (connection pooling)
 * Reuses existing connection instead of creating new ones
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }

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
    }
  }

  // Create new client with connection pooling settings
  // Reduced pool size for M0 cluster (500 connection limit)
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    maxPoolSize: 5, // Reduced from 10 to prevent hitting M0 limit (500 connections)
    minPoolSize: 1, // Reduced from 2 to minimize connections
    maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
    socketTimeoutMS: 45000, // Close idle sockets after 45s
  });

  await client.connect();
  cachedClient = client;

  // Auto-setup indexes on first connection
  const { autoSetupIndexes } = await import('@/app/utils/mongodb-auto-index');
  autoSetupIndexes().catch(() => {});

  return client;
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

