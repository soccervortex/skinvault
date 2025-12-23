/**
 * MongoDB Index Setup Script
 * Run this to create indexes for optimal chat performance on MongoDB Atlas M0 (free tier)
 * 
 * Usage: This can be called from an API route or run manually in MongoDB Compass/Shell
 */

export interface IndexDefinition {
  collection: string;
  index: Record<string, 1 | -1>;
  options?: {
    name?: string;
    unique?: boolean;
    expireAfterSeconds?: number;
  };
}

/**
 * Index definitions for chat collections
 * These indexes optimize queries for:
 * - Finding messages by conversation/dmId
 * - Sorting by timestamp
 * - Auto-deleting old messages (TTL)
 */
export const CHAT_INDEXES: IndexDefinition[] = [
  // Global chat messages: compound index on timestamp (for sorting)
  {
    collection: 'chats_*', // Wildcard for date-based collections
    index: { timestamp: -1 },
    options: {
      name: 'timestamp_desc',
      expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days TTL for global chat
    },
  },
  // DM messages: compound index on dmId + timestamp
  {
    collection: 'dms_*', // Wildcard for date-based DM collections
    index: { dmId: 1, timestamp: -1 },
    options: {
      name: 'dmId_timestamp_desc',
    },
  },
  // DM messages: timestamp index for TTL (365 days)
  {
    collection: 'dms_*',
    index: { timestamp: 1 },
    options: {
      name: 'timestamp_ttl',
      expireAfterSeconds: 365 * 24 * 60 * 60, // 365 days TTL for DMs
    },
  },
  // DM invites: index on participants and status
  {
    collection: 'dm_invites',
    index: { fromSteamId: 1, toSteamId: 1, status: 1 },
    options: {
      name: 'invite_lookup',
    },
  },
];

/**
 * Create indexes for a specific collection
 * Note: MongoDB doesn't support wildcards in collection names for index creation
 * You need to create indexes on each actual collection
 */
export async function createIndexesForCollection(
  db: any,
  collectionName: string,
  indexes: IndexDefinition[]
): Promise<void> {
  const collection = db.collection(collectionName);
  
  for (const indexDef of indexes) {
    // Check if collection matches pattern
    const matchesPattern = 
      (indexDef.collection.includes('chats_') && collectionName.startsWith('chats_')) ||
      (indexDef.collection.includes('dms_') && collectionName.startsWith('dms_')) ||
      indexDef.collection === collectionName;
    
    if (!matchesPattern) continue;
    
    try {
      await collection.createIndex(indexDef.index, indexDef.options || {});
      console.log(`✅ Created index on ${collectionName}:`, indexDef.index);
    } catch (error: any) {
      // Index might already exist, that's okay
      if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
        console.log(`⚠️  Index already exists on ${collectionName}:`, indexDef.index);
      } else {
        console.error(`❌ Failed to create index on ${collectionName}:`, error);
      }
    }
  }
}

/**
 * Create indexes for all existing chat collections
 * This should be run periodically or on startup
 */
export async function setupChatIndexes(mongoClient: any, dbName: string): Promise<void> {
  const db = mongoClient.db(dbName);
  const collections = await db.listCollections().toArray();
  
  // Find all chat-related collections
  const chatCollections = collections.filter((col: any) => 
    col.name.startsWith('chats_') || 
    col.name.startsWith('dms_') || 
    col.name === 'dm_invites'
  );
  
  console.log(`Found ${chatCollections.length} chat collections to index`);
  
  for (const col of chatCollections) {
    await createIndexesForCollection(db, col.name, CHAT_INDEXES);
  }
  
  console.log('✅ Index setup complete');
}

