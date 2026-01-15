/**
 * Automatic MongoDB Index Setup
 * This will automatically create indexes when the app starts or connects to MongoDB
 */

import { getDatabase, hasMongoConfig } from './mongodb-client';

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
      if (!hasMongoConfig()) {
        console.log('⚠️  MongoDB not configured, skipping index setup');
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

      // Inventory cache: TTL cleanup + lookup
      try {
        const invCache = db.collection('inventory_cache');
        await invCache.createIndex({ expiresAt: 1 }, { name: 'expiresAt_ttl', expireAfterSeconds: 0 });
        results.push('✅ Created TTL index on inventory_cache.expiresAt');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  inventory_cache TTL: ${error?.message || String(error)}`);
        }
      }

      try {
        const invCache = db.collection('inventory_cache');
        await invCache.createIndex(
          { steamId: 1, currency: 1, startAssetId: 1, expiresAt: 1 },
          { name: 'inventory_cache_lookup' }
        );
        results.push('✅ Created lookup index on inventory_cache');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  inventory_cache lookup: ${error?.message || String(error)}`);
        }
      }

      try {
        const surpriseCache = db.collection('surprise_cache');
        await surpriseCache.createIndex({ expiresAt: 1 }, { name: 'expiresAt_ttl', expireAfterSeconds: 0 });
        results.push('✅ Created TTL index on surprise_cache.expiresAt');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  surprise_cache TTL: ${error?.message || String(error)}`);
        }
      }

      try {
        const surpriseCache = db.collection('surprise_cache');
        await surpriseCache.createIndex(
          { expiresAt: 1, createdAt: 1 },
          { name: 'surprise_cache_lookup' }
        );
        results.push('✅ Created lookup index on surprise_cache');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  surprise_cache lookup: ${error?.message || String(error)}`);
        }
      }

      // Giveaway claims: unique per (giveawayId, steamId) + polling helpers
      try {
        const giveawayClaims = db.collection('giveaway_claims');
        await giveawayClaims.createIndex(
          { giveawayId: 1, steamId: 1 },
          { name: 'giveawayId_steamId_unique', unique: true }
        );
        results.push('✅ Created unique index on giveaway_claims (giveawayId, steamId)');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  giveaway_claims unique: ${error?.message || String(error)}`);
        }
      }

      try {
        const giveawayClaims = db.collection('giveaway_claims');
        await giveawayClaims.createIndex(
          { tradeStatus: 1, updatedAt: -1 },
          { name: 'tradeStatus_updatedAt_desc' }
        );
        results.push('✅ Created polling index on giveaway_claims (tradeStatus, updatedAt)');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  giveaway_claims polling: ${error?.message || String(error)}`);
        }
      }

      try {
        const giveawayClaims = db.collection('giveaway_claims');
        await giveawayClaims.createIndex(
          { steamTradeOfferId: 1 },
          { name: 'steamTradeOfferId_lookup' }
        );
        results.push('✅ Created lookup index on giveaway_claims.steamTradeOfferId');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  giveaway_claims steamTradeOfferId: ${error?.message || String(error)}`);
        }
      }

      try {
        const giveawayClaims = db.collection('giveaway_claims');
        await giveawayClaims.createIndex(
          { prizeStockId: 1 },
          { name: 'prizeStockId_lookup' }
        );
        results.push('✅ Created lookup index on giveaway_claims.prizeStockId');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  giveaway_claims prizeStockId: ${error?.message || String(error)}`);
        }
      }

      try {
        const giveawayClaims = db.collection('giveaway_claims');
        await giveawayClaims.createIndex(
          { assetId: 1 },
          { name: 'assetId_lookup' }
        );
        results.push('✅ Created lookup index on giveaway_claims.assetId');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  giveaway_claims assetId: ${error?.message || String(error)}`);
        }
      }

      // Giveaway prize stock: unique Steam asset + reserve helpers
      try {
        const giveawayPrizeStock = db.collection('giveaway_prize_stock');
        await giveawayPrizeStock.createIndex(
          { appId: 1, contextId: 1, assetId: 1 },
          { name: 'steam_asset_unique', unique: true }
        );
        results.push('✅ Created unique index on giveaway_prize_stock (appId, contextId, assetId)');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  giveaway_prize_stock unique: ${error?.message || String(error)}`);
        }
      }

      try {
        const giveawayPrizeStock = db.collection('giveaway_prize_stock');
        await giveawayPrizeStock.createIndex(
          { giveawayId: 1, status: 1, createdAt: 1 },
          { name: 'giveawayId_status_createdAt' }
        );
        results.push('✅ Created reserve index on giveaway_prize_stock (giveawayId, status, createdAt)');
      } catch (error: any) {
        if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
          // Already exists
        } else {
          results.push(`⚠️  giveaway_prize_stock reserve: ${error?.message || String(error)}`);
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
  if (!hasMongoConfig()) return;

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

