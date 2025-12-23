/**
 * Test script for chat and admin panel functions
 * Run with: node scripts/test-chat-functions.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_STEAM_ID = process.env.TEST_STEAM_ID || '76561198758560045';
const ADMIN_STEAM_ID = process.env.ADMIN_STEAM_ID || '';

async function testAPI(endpoint, options = {}) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`\n[TEST] ${options.method || 'GET'} ${endpoint}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`[✓] Success:`, JSON.stringify(data, null, 2).substring(0, 200));
      return { success: true, data };
    } else {
      console.log(`[✗] Error (${response.status}):`, data.error || data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`[✗] Exception:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('CHAT & ADMIN PANEL FUNCTIONALITY TESTS');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  // Test 1: Get global chat messages
  console.log('\n--- Test 1: Get Global Chat Messages ---');
  const test1 = await testAPI('/api/chat/messages');
  results.tests.push({ name: 'Get Global Chat Messages', ...test1 });
  if (test1.success) results.passed++; else results.failed++;

  // Test 2: Send a chat message
  console.log('\n--- Test 2: Send Chat Message ---');
  const test2 = await testAPI('/api/chat/messages', {
    method: 'POST',
    body: JSON.stringify({
      steamId: TEST_STEAM_ID,
      message: `Test message at ${new Date().toISOString()}`,
    }),
  });
  results.tests.push({ name: 'Send Chat Message', ...test2 });
  if (test2.success) results.passed++; else results.failed++;

  // Test 3: Get DM list
  console.log('\n--- Test 3: Get DM List ---');
  const test3 = await testAPI(`/api/chat/dms/list?steamId=${TEST_STEAM_ID}`);
  results.tests.push({ name: 'Get DM List', ...test3 });
  if (test3.success) results.passed++; else results.failed++;

  // Test 4: Get DM invites
  console.log('\n--- Test 4: Get DM Invites ---');
  const test4 = await testAPI(`/api/chat/dms/invites?steamId=${TEST_STEAM_ID}&type=pending`);
  results.tests.push({ name: 'Get DM Invites', ...test4 });
  if (test4.success) results.passed++; else results.failed++;

  // Test 5: Admin - Get user info
  if (ADMIN_STEAM_ID) {
    console.log('\n--- Test 5: Admin - Get User Info ---');
    const test5 = await testAPI(`/api/admin/user/${TEST_STEAM_ID}?adminSteamId=${ADMIN_STEAM_ID}`);
    results.tests.push({ name: 'Admin - Get User Info', ...test5 });
    if (test5.success) results.passed++; else results.failed++;

    // Test 6: Admin - Get reports
    console.log('\n--- Test 6: Admin - Get Reports ---');
    const test6 = await testAPI(`/api/chat/report?adminSteamId=${ADMIN_STEAM_ID}`);
    results.tests.push({ name: 'Admin - Get Reports', ...test6 });
    if (test6.success) results.passed++; else results.failed++;

    // Test 7: Admin - Get timeouts
    console.log('\n--- Test 7: Admin - Get Timeouts ---');
    const test7 = await testAPI(`/api/admin/timeouts?adminSteamId=${ADMIN_STEAM_ID}`);
    results.tests.push({ name: 'Admin - Get Timeouts', ...test7 });
    if (test7.success) results.passed++; else results.failed++;

    // Test 8: Admin - Get user count
    console.log('\n--- Test 8: Admin - Get User Count ---');
    const test8 = await testAPI('/api/admin/user-count');
    results.tests.push({ name: 'Admin - Get User Count', ...test8 });
    if (test8.success) results.passed++; else results.failed++;
  } else {
    console.log('\n[SKIP] Admin tests (ADMIN_STEAM_ID not set)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log('\nDetailed Results:');
  results.tests.forEach((test, i) => {
    const status = test.success ? '✓' : '✗';
    console.log(`  ${i + 1}. ${status} ${test.name}`);
  });

  return results;
}

// Run tests
if (require.main === module) {
  runTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { runTests, testAPI };

