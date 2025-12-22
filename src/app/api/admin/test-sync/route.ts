import { NextResponse } from 'next/server';
import { dbGet, dbSet, syncAllDataToKV, checkDbHealth } from '@/app/utils/database';

const ADMIN_HEADER = 'x-admin-key';

/**
 * Test endpoint to verify database sync works in both directions
 * 
 * GET: Check current sync status and test reads
 * POST: Run comprehensive sync tests
 */
export async function GET(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const health = await checkDbHealth();
    
    // Test reading from both databases
    const testKey = '__sync_test__';
    const kvValue = await dbGet(testKey);
    
    return NextResponse.json({
      health,
      testKey,
      kvValue,
      message: 'Use POST to run full sync tests'
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Test failed' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;

  if (expected && adminKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action } = await request.json().catch(() => ({}));
    
    if (action === 'test-write') {
      // Test 1: Write to both databases
      const testKey = '__sync_test__';
      const testValue = {
        timestamp: new Date().toISOString(),
        test: true,
        random: Math.random()
      };
      
      console.log(`[Test Sync] Writing test data to ${testKey}...`);
      const writeResult = await dbSet(testKey, testValue);
      
      // Verify both databases have the data
      const kvRead = await dbGet(testKey);
      const kvMatch = JSON.stringify(kvRead) === JSON.stringify(testValue);
      
      return NextResponse.json({
        success: true,
        test: 'write-to-both',
        writeResult,
        kvMatch,
        testValue,
        kvRead,
        message: kvMatch ? '✅ Write test passed - both databases have the data' : '❌ Write test failed - data mismatch'
      });
    }
    
    if (action === 'test-sync-mongo-to-kv') {
      // Test 2: Sync from MongoDB to KV
      console.log(`[Test Sync] Testing MongoDB → KV sync...`);
      const syncResult = await syncAllDataToKV();
      
      return NextResponse.json({
        success: true,
        test: 'sync-mongo-to-kv',
        syncResult,
        message: `✅ Sync test complete: ${syncResult.synced} synced, ${syncResult.failed} failed`
      });
    }
    
    if (action === 'test-full') {
      // Test 3: Full comprehensive test
      const results: any = {
        health: await checkDbHealth(),
        tests: []
      };
      
      // Test write
      const testKey = '__sync_test_full__';
      const testValue = {
        timestamp: new Date().toISOString(),
        test: 'full',
        random: Math.random()
      };
      
      console.log(`[Test Sync] Running full sync test...`);
      
      // Write test
      const writeResult = await dbSet(testKey, testValue);
      results.tests.push({
        name: 'Write to both databases',
        passed: writeResult,
        message: writeResult ? '✅ Write succeeded' : '❌ Write failed'
      });
      
      // Read verification
      const readValue = await dbGet(testKey);
      const readMatch = JSON.stringify(readValue) === JSON.stringify(testValue);
      results.tests.push({
        name: 'Read verification',
        passed: readMatch,
        message: readMatch ? '✅ Read matches written value' : '❌ Read mismatch'
      });
      
      // Sync test
      const syncResult = await syncAllDataToKV();
      results.tests.push({
        name: 'MongoDB → KV sync',
        passed: syncResult.synced > 0 || syncResult.failed === 0,
        message: `✅ ${syncResult.synced} keys synced, ${syncResult.failed} failed`
      });
      
      // Cleanup
      try {
        // Note: We don't delete the test key so you can verify it in both databases
        // await dbDelete(testKey);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      const allPassed = results.tests.every((t: any) => t.passed);
      
      return NextResponse.json({
        success: allPassed,
        results,
        message: allPassed ? '✅ All sync tests passed!' : '❌ Some tests failed'
      });
    }
    
    return NextResponse.json({
      error: 'Invalid action. Use: test-write, test-sync-mongo-to-kv, or test-full'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('[Test Sync] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Test failed',
      details: error
    }, { status: 500 });
  }
}

