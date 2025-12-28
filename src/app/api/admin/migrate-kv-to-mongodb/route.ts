import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getDatabase } from '@/app/utils/mongodb-client';
import { isOwner } from '@/app/utils/owner-ids';

const ADMIN_HEADER = 'x-admin-key';

// All KV keys used in the application
const KV_KEYS = [
  'pro_users',
  'first_logins',
  'claimed_free_month',
  'purchase_history',
  'failed_purchases',
  'user_rewards',
  'discord_connections',
  'price_alerts',
  'banned_steam_ids',
  'stripe_test_mode',
  'active_theme',
  'user_theme_preferences',
  // Theme gift claims (dynamic keys)
  'theme_gift_claims_2024_christmas',
  'theme_gift_claims_2024_halloween',
  'theme_gift_claims_2024_easter',
  'theme_gift_claims_2024_sinterklaas',
  'theme_gift_claims_2024_newyear',
  'theme_gift_claims_2024_oldyear',
];

/**
 * POST /api/admin/migrate-kv-to-mongodb
 * Migrate all KV data to MongoDB
 */
export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

  if (!MONGODB_URI) {
    return NextResponse.json({ error: 'MongoDB URI not configured' }, { status: 400 });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 400 });
  }

  try {
    // Use shared connection pool
    const db = await getDatabase();

    const results: Array<{ key: string; status: 'success' | 'error' | 'not_found'; error?: string }> = [];
    let totalMigrated = 0;
    let totalErrors = 0;
    let totalNotFound = 0;

    // Migrate each key (each key becomes its own collection)
    for (const key of KV_KEYS) {
      try {
        // Get value from KV
        const value = await kv.get(key);

        if (value === null || value === undefined) {
          results.push({ key, status: 'not_found' });
          totalNotFound++;
          continue;
        }

        // Sanitize key name for MongoDB collection name
        const collectionName = key.replace(/[^a-zA-Z0-9_]/g, '_');
        const collection = db.collection(collectionName);

        // Save to MongoDB (each key = its own collection)
        await collection.updateOne(
          { _id: key } as any,
          {
            $set: {
              _id: key,
              value,
              updatedAt: new Date(),
              migratedAt: new Date(),
              source: 'kv_migration',
            },
          },
          { upsert: true }
        );

        results.push({ key, status: 'success' });
        totalMigrated++;
      } catch (error: any) {
        console.error(`Failed to migrate key ${key}:`, error);
        results.push({
          key,
          status: 'error',
          error: error.message || 'Unknown error',
        });
        totalErrors++;
      }
    }

    // Also try to find any other keys in KV (if possible)
    // Note: KV doesn't support key listing via REST API, so we can't discover all keys
    // But we can try common patterns

    // Don't close connection - it's from shared pool

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${totalMigrated} keys migrated, ${totalErrors} errors, ${totalNotFound} not found`,
      summary: {
        total: KV_KEYS.length,
        migrated: totalMigrated,
        errors: totalErrors,
        notFound: totalNotFound,
      },
      results,
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      {
        error: error.message || 'Migration failed',
        details: error,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate-kv-to-mongodb
 * Check migration status (compare KV and MongoDB)
 */
export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

  if (!MONGODB_URI) {
    return NextResponse.json({ error: 'MongoDB URI not configured' }, { status: 400 });
  }

  try {
    // Use shared connection pool
    const db = await getDatabase();

    const comparison: Array<{
      key: string;
      inKV: boolean;
      inMongoDB: boolean;
      match: boolean;
    }> = [];

    for (const key of KV_KEYS) {
      try {
        const kvValue = await kv.get(key);
        // Each key is its own collection
        const collectionName = key.replace(/[^a-zA-Z0-9_]/g, '_');
        const collection = db.collection(collectionName);
        const mongoDoc = await collection.findOne({ _id: key } as any);

        comparison.push({
          key,
          inKV: kvValue !== null && kvValue !== undefined,
          inMongoDB: mongoDoc !== null,
          match: JSON.stringify(kvValue) === JSON.stringify(mongoDoc?.value),
        });
      } catch (error) {
        comparison.push({
          key,
          inKV: false,
          inMongoDB: false,
          match: false,
        });
      }
    }

    // Don't close connection - it's from shared pool

    const inBoth = comparison.filter((c) => c.inKV && c.inMongoDB).length;
    const onlyKV = comparison.filter((c) => c.inKV && !c.inMongoDB).length;
    const onlyMongoDB = comparison.filter((c) => !c.inKV && c.inMongoDB).length;
    const matches = comparison.filter((c) => c.match).length;

    return NextResponse.json({
      summary: {
        total: KV_KEYS.length,
        inBoth,
        onlyKV,
        onlyMongoDB,
        matches,
        mismatches: inBoth - matches,
      },
      comparison,
    });
  } catch (error: any) {
    console.error('Failed to check migration status:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to check migration status',
      },
      { status: 500 }
    );
  }
}

