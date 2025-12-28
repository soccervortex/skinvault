/**
 * Automatic MongoDB Index Setup
 * This will automatically create indexes when the app starts or connects to MongoDB
 */

import { getDatabase } from './mongodb-client';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

let indexesSetup = false;
let setupPromise: Promise<void> | null = null;

/**
 * Automatically setup indexes for all chat collections
 * This runs once per application lifecycle
 */
export async function autoSetupIndexes(): Promise<void> {
  // Only run once
  if (indexesSetup) {
    return;
  }

  // If setup is already in progress, wait for it
  if (setupPromise) {
    return setupPromise;
  }

  // Start setup
  setupPromise = (async () => {
    try {
      if (!MONGODB_URI) {
        console.log('⚠️  MongoDB URI not configured, skipping index setup');
        return;
      }

      // Use shared connection pool instead of creating new client
      const db = await getDatabase();

      console.log('🔧 Setting up MongoDB indexes automatically...');

      // Get all existing collections
      const collections = await db.listCollections().toArray();
      
      // Find all chat-related collections
      const chatCollections = collections.filter((col: any) => 
        col.name.startsWith('chats_') || 
        col.name.startsWith('dms_') || 
        col.name === 'dm_invites'
      );

      const results: string[] = [];

      // Setup indexes for each collection
      for (const col of chatCollections) {
        const collection = db.collection(col.name);

        if (col.name.startsWith('chats_')) {
          // Global chat: timestamp index
          try {
            await collection.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' });
            results.push(`✅ Created timestamp index on ${col.name}`);
          } catch (error: any) {
            if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
              // Index already exists, that's fine
            } else {
              results.push(`⚠️  ${col.name}: ${error.message}`);
            }
          }
        } else if (col.name.startsWith('dms_')) {
          // DM: compound index on dmId + timestamp
          try {
            await collection.createIndex({ dmId: 1, timestamp: -1 }, { name: 'dmId_timestamp_desc' });
            results.push(`✅ Created dmId_timestamp index on ${col.name}`);
          } catch (error: any) {
            if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
              // Index already exists
            } else {
              results.push(`⚠️  ${col.name}: ${error.message}`);
            }
          }

          // DM: timestamp index for TTL (365 days)
          try {
            await collection.createIndex(
              { timestamp: 1 },
              { name: 'timestamp_ttl', expireAfterSeconds: 365 * 24 * 60 * 60 }
            );
            results.push(`✅ Created TTL index on ${col.name}`);
          } catch (error: any) {
            if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
              // Index already exists
            } else {
              results.push(`⚠️  ${col.name} TTL: ${error.message}`);
            }
          }
        } else if (col.name === 'dm_invites') {
          // Invites: compound index
          try {
            await collection.createIndex(
              { fromSteamId: 1, toSteamId: 1, status: 1 },
              { name: 'invite_lookup' }
            );
            results.push(`✅ Created invite_lookup index on ${col.name}`);
          } catch (error: any) {
            if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
              // Index already exists
            } else {
              results.push(`⚠️  ${col.name}: ${error.message}`);
            }
          }
        }
      }

      // Don't close connection - it's from shared pool

      if (results.length > 0) {
        console.log('📊 Index setup results:');
        results.forEach(r => console.log(`  ${r}`));
      }

      console.log('✅ MongoDB indexes setup complete');
      indexesSetup = true;
      // Don't close connection - it's from shared pool
    } catch (error: any) {
      console.error('❌ Failed to setup indexes automatically:', error.message);
      // Don't throw - allow app to continue even if index setup fails
    }
  })();

  return setupPromise;
}

/**
 * Setup indexes for a specific collection (called when new collections are created)
 */
export async function setupIndexesForCollection(collectionName: string): Promise<void> {
  if (!MONGODB_URI) return;

  try {
    // Use shared connection pool instead of creating new client
    const db = await getDatabase();
    const collection = db.collection(collectionName);

    if (collectionName.startsWith('chats_')) {
      await collection.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' }).catch(() => {});
    } else if (collectionName.startsWith('dms_')) {
      await collection.createIndex({ dmId: 1, timestamp: -1 }, { name: 'dmId_timestamp_desc' }).catch(() => {});
      await collection.createIndex(
        { timestamp: 1 },
        { name: 'timestamp_ttl', expireAfterSeconds: 365 * 24 * 60 * 60 }
      ).catch(() => {});
    }

    // Don't close connection - it's from shared pool
  } catch (error) {
    // Silently fail - indexes will be created on next auto-setup
    console.warn(`Failed to setup indexes for ${collectionName}:`, error);
  }
}

