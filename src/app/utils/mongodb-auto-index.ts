/**
 * Automatic MongoDB Index Setup
 * This will automatically create indexes when the app starts or connects to MongoDB
 */

import { Db } from 'mongodb';
import { getChatDatabase, getDatabase, hasChatMongoConfig, hasMongoConfig } from './mongodb-client';

let indexesSetup = false;
let setupPromise: Promise<void> | null = null;

async function createIndexSafe(collection: any, index: any, options: any, results?: string[], okMsg?: string, errMsg?: string) {
  try {
    await collection.createIndex(index, options);
    if (results && okMsg) results.push(okMsg);
  } catch (error: any) {
    if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
      // Already exists
    } else if (results && errMsg) {
      results.push(`${errMsg}: ${error?.message || String(error)}`);
    }
  }
}

export async function setupCoreIndexes(db: Db): Promise<void> {
  try {
    await createIndexSafe(
      db.collection('giveaway_claims'),
      { giveawayId: 1, steamId: 1 },
      { name: 'giveawayId_steamId_unique', unique: true },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('giveaway_claims'),
      { tradeStatus: 1, updatedAt: -1 },
      { name: 'tradeStatus_updatedAt_desc' },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('giveaway_claims'),
      { steamTradeOfferId: 1 },
      { name: 'steamTradeOfferId_lookup' },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('giveaway_claims'),
      { prizeStockId: 1 },
      { name: 'prizeStockId_lookup' },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('giveaway_claims'),
      { assetId: 1 },
      { name: 'assetId_lookup' },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('giveaway_prize_stock'),
      { appId: 1, contextId: 1, assetId: 1 },
      { name: 'steam_asset_unique', unique: true },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('giveaway_prize_stock'),
      { giveawayId: 1, status: 1, createdAt: 1 },
      { name: 'giveawayId_status_createdAt' },
      undefined,
      undefined,
      undefined
    );
  } catch {
  }
}

export async function setupChatAndCacheIndexes(db: Db): Promise<void> {
  try {
    const collections = await db.listCollections().toArray();

    const chatCollections = collections.filter(
      (col: any) => col.name.startsWith('chats_') || col.name.startsWith('dms_') || col.name === 'dm_invites'
    );

    for (const col of chatCollections) {
      const collection = db.collection(col.name);

      if (col.name.startsWith('chats_')) {
        await createIndexSafe(collection, { timestamp: -1 }, { name: 'timestamp_desc' }, undefined, undefined, undefined);
      } else if (col.name.startsWith('dms_')) {
        await createIndexSafe(collection, { dmId: 1, timestamp: -1 }, { name: 'dmId_timestamp_desc' }, undefined, undefined, undefined);
        await createIndexSafe(
          collection,
          { timestamp: 1 },
          { name: 'timestamp_ttl', expireAfterSeconds: 365 * 24 * 60 * 60 },
          undefined,
          undefined,
          undefined
        );
      } else if (col.name === 'dm_invites') {
        await createIndexSafe(
          collection,
          { fromSteamId: 1, toSteamId: 1, status: 1 },
          { name: 'invite_lookup' },
          undefined,
          undefined,
          undefined
        );
      }
    }

    await createIndexSafe(
      db.collection('inventory_cache'),
      { expiresAt: 1 },
      { name: 'expiresAt_ttl', expireAfterSeconds: 0 },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('inventory_cache'),
      { steamId: 1, currency: 1, startAssetId: 1, expiresAt: 1 },
      { name: 'inventory_cache_lookup' },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('surprise_cache'),
      { expiresAt: 1 },
      { name: 'expiresAt_ttl', expireAfterSeconds: 0 },
      undefined,
      undefined,
      undefined
    );

    await createIndexSafe(
      db.collection('surprise_cache'),
      { expiresAt: 1, createdAt: 1 },
      { name: 'surprise_cache_lookup' },
      undefined,
      undefined,
      undefined
    );
  } catch {
  }
}

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
      const results: string[] = [];

      if (hasMongoConfig()) {
        const coreDb = await getDatabase();
        await setupCoreIndexes(coreDb);
      }

      if (hasChatMongoConfig()) {
        const chatDb = await getChatDatabase();
        await setupChatAndCacheIndexes(chatDb);
      }

      if (results.length > 0) {
        console.log('📊 Index setup results:');
        results.forEach((r) => console.log(`  ${r}`));
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
  if (!hasMongoConfig() && !hasChatMongoConfig()) return;

  try {
    const isChatCollection = collectionName.startsWith('chats_') || collectionName.startsWith('dms_') || collectionName === 'dm_invites';
    const isCacheCollection = collectionName === 'inventory_cache' || collectionName === 'surprise_cache';

    if ((isChatCollection || isCacheCollection) && hasChatMongoConfig()) {
      const db = await getChatDatabase();
      const collection = db.collection(collectionName);

      if (collectionName.startsWith('chats_')) {
        await collection.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' }).catch(() => {});
      } else if (collectionName.startsWith('dms_')) {
        await collection.createIndex({ dmId: 1, timestamp: -1 }, { name: 'dmId_timestamp_desc' }).catch(() => {});
        await collection
          .createIndex({ timestamp: 1 }, { name: 'timestamp_ttl', expireAfterSeconds: 365 * 24 * 60 * 60 })
          .catch(() => {});
      } else if (collectionName === 'dm_invites') {
        await collection
          .createIndex({ fromSteamId: 1, toSteamId: 1, status: 1 }, { name: 'invite_lookup' })
          .catch(() => {});
      } else if (collectionName === 'inventory_cache') {
        await collection.createIndex({ expiresAt: 1 }, { name: 'expiresAt_ttl', expireAfterSeconds: 0 }).catch(() => {});
        await collection
          .createIndex({ steamId: 1, currency: 1, startAssetId: 1, expiresAt: 1 }, { name: 'inventory_cache_lookup' })
          .catch(() => {});
      } else if (collectionName === 'surprise_cache') {
        await collection.createIndex({ expiresAt: 1 }, { name: 'expiresAt_ttl', expireAfterSeconds: 0 }).catch(() => {});
        await collection
          .createIndex({ expiresAt: 1, createdAt: 1 }, { name: 'surprise_cache_lookup' })
          .catch(() => {});
      }
      return;
    }

    if (hasMongoConfig()) {
      const db = await getDatabase();
      const collection = db.collection(collectionName);

      if (collectionName === 'giveaway_claims') {
        await collection
          .createIndex({ giveawayId: 1, steamId: 1 }, { name: 'giveawayId_steamId_unique', unique: true })
          .catch(() => {});
      }
    }

    // Don't close connection - it's from shared pool
  } catch (error) {
    // Silently fail - indexes will be created on next auto-setup
    console.warn(`Failed to setup indexes for ${collectionName}:`, error);
  }
}

