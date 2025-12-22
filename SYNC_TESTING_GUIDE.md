# Database Sync Testing Guide

## Overview

This guide explains how to test the database sync system to ensure it works correctly in both directions (KV ↔ MongoDB).

## Test Endpoint

A new test endpoint has been created: `/api/admin/test-sync`

### Authentication

All requests require the `x-admin-key` header with your admin token.

```bash
curl -X POST https://your-domain.com/api/admin/test-sync \
  -H "x-admin-key: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-full"}'
```

## Test Actions

### 1. Test Write to Both Databases

Tests that `dbSet` writes to both KV and MongoDB:

```bash
curl -X POST https://your-domain.com/api/admin/test-sync \
  -H "x-admin-key: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-write"}'
```

**Expected Result:**
- ✅ Write succeeds
- ✅ KV has the data
- ✅ MongoDB has the data
- ✅ Both match

### 2. Test MongoDB → KV Sync

Tests the full sync function:

```bash
curl -X POST https://your-domain.com/api/admin/test-sync \
  -H "x-admin-key: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-sync-mongo-to-kv"}'
```

**Expected Result:**
- ✅ Sync completes
- ✅ Shows number of keys synced
- ✅ Shows any failures

### 3. Full Comprehensive Test

Runs all tests:

```bash
curl -X POST https://your-domain.com/api/admin/test-sync \
  -H "x-admin-key: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-full"}'
```

**Expected Result:**
- ✅ All tests pass
- ✅ Write test: Both databases receive data
- ✅ Read test: Data matches what was written
- ✅ Sync test: MongoDB → KV sync works

## Manual Testing Steps

### Test 1: Normal Write (Both Databases)

1. Make a purchase or grant Pro status
2. Check Vercel logs for:
   - `[Database] ✅ MongoDB write succeeded for purchase_history`
   - `[Database] Write summary for purchase_history: KV ✅ | MongoDB ✅`
3. Verify in Upstash KV console: Data exists
4. Verify in MongoDB Atlas: Data exists in collection

### Test 2: KV Down, MongoDB Works

1. Temporarily disable KV (or wait for rate limit)
2. Make a purchase
3. Check logs: Should see MongoDB write succeed, KV write fail
4. Verify MongoDB has the data
5. Re-enable KV
6. Check logs: Should see automatic sync trigger
7. Verify KV now has the data

### Test 3: Automatic Sync on Recovery

1. Ensure KV is down (or rate limited)
2. Make several purchases (data goes to MongoDB only)
3. Wait for KV to recover (or manually trigger recovery)
4. Check logs: Should see `[Database] ✅ KV recovered! Triggering full sync...`
5. Verify all MongoDB data synced to KV

### Test 4: Read from MongoDB, Sync to KV

1. Ensure KV is down
2. Read data (e.g., `/api/user/rewards`)
3. Check logs: Should read from MongoDB
4. Re-enable KV
5. Read same data again
6. Check logs: Should sync from MongoDB to KV automatically

## Verification Commands

### Check Database Health

```bash
curl -X GET https://your-domain.com/api/admin/db-health \
  -H "x-admin-key: YOUR_ADMIN_TOKEN"
```

### Manual Sync Trigger

```bash
curl -X POST https://your-domain.com/api/admin/db-sync \
  -H "x-admin-key: YOUR_ADMIN_TOKEN"
```

### Compare KV and MongoDB

```bash
curl -X GET https://your-domain.com/api/admin/migrate-kv-to-mongodb \
  -H "x-admin-key: YOUR_ADMIN_TOKEN"
```

## What to Look For in Logs

### Successful Write
```
[Database] ✅ MongoDB write acknowledged for purchase_history (created, matched: 0, modified: 0, upserted: 1)
[Database] ✅ Verified MongoDB write for purchase_history
[Database] Write summary for purchase_history: KV ✅ | MongoDB ✅
```

### MongoDB Write Failure
```
[Database] ❌ MongoDB set failed for purchase_history: [error message]
[Database] Write summary for purchase_history: KV ✅ | MongoDB ❌
```

### Automatic Sync
```
[Database] ✅ KV recovered! Triggering full sync from MongoDB to KV...
[Database] 🔄 Starting full sync from MongoDB to KV...
[Database] ✅ Synced purchase_history from MongoDB to KV
[Database] ✅ Full sync complete: 5 keys synced, 0 failed, 13 total
```

### Read Recovery
```
[Database] Synced purchase_history from MongoDB to KV (read recovery)
[Database] KV recovered during read, triggering full sync from MongoDB...
```

## Troubleshooting

### MongoDB Not Receiving Writes

1. Check `MONGODB_URI` is set in environment variables
2. Check MongoDB connection logs: `[Database] ✅ MongoDB connected successfully`
3. Check for write errors in logs
4. Verify MongoDB Atlas network access allows Vercel IPs

### Sync Not Working

1. Check both databases are available: `/api/admin/db-health`
2. Check sync logs for errors
3. Manually trigger sync: `/api/admin/db-sync`
4. Verify collections exist in MongoDB

### Data Mismatch

1. Use compare endpoint: `/api/admin/migrate-kv-to-mongodb` (GET)
2. Check which keys differ
3. Manually trigger sync to fix

## Expected Behavior Summary

✅ **Writes:** Always go to both KV and MongoDB  
✅ **Reads:** Try KV first, fallback to MongoDB  
✅ **Auto-sync:** MongoDB → KV when KV recovers  
✅ **Per-key sync:** Individual keys sync when read from MongoDB  
✅ **Full sync:** All MongoDB data syncs when KV recovers  
✅ **No data loss:** MongoDB always has backup  

## Success Criteria

All tests should pass:
- ✅ Write test: Both databases receive data
- ✅ Read test: Data matches
- ✅ Sync test: MongoDB → KV works
- ✅ Recovery test: Automatic sync triggers
- ✅ Verification: Both databases stay in sync

