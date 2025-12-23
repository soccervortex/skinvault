# MongoDB Chat Performance Optimization Guide

This guide explains the optimizations implemented to improve chat performance on MongoDB Atlas M0 (free tier).

## 🚀 Optimizations Implemented

### 1. **Compound Indexes** ✅
Indexes are created on:
- **Global Chat**: `{ timestamp: -1 }` - Fast sorting by time
- **DM Messages**: `{ dmId: 1, timestamp: -1 }` - Fast lookup by conversation + time
- **DM Invites**: `{ fromSteamId: 1, toSteamId: 1, status: 1 }` - Fast invite lookup

### 2. **Cursor-Based Pagination** ✅
Replaced `skip()` and `limit()` with cursor-based pagination:
- **Before**: `skip(100).limit(50)` - Slow, gets slower as data grows
- **After**: `find({ timestamp: { $lt: cursor } }).limit(50)` - Fast, stays fast forever

### 3. **Projections** ✅
Only fetch needed fields from database:
- Reduces network transfer
- Saves memory on free tier
- Faster queries

### 4. **TTL Indexes** (Optional)
Auto-delete old messages to stay under 512MB limit:
- Global chat: 30 days (configurable)
- DMs: 365 days (configurable)

## 📋 Setup Instructions

### Step 1: Create Indexes

**Option A: Use the Admin API** (Recommended)
```bash
# Replace YOUR_STEAM_ID with your admin Steam ID
POST /api/admin/setup-indexes?steamId=YOUR_STEAM_ID
```

**Option B: Manual Setup in MongoDB Compass/Shell**

For each date-based collection (e.g., `chats_2025-01-15`, `dms_2025-01-15`):

```javascript
// Global chat collections
db.chats_YYYY-MM-DD.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' });

// DM collections
db.dms_YYYY-MM-DD.createIndex({ dmId: 1, timestamp: -1 }, { name: 'dmId_timestamp_desc' });
db.dms_YYYY-MM-DD.createIndex({ timestamp: 1 }, { name: 'timestamp_ttl', expireAfterSeconds: 31536000 }); // 365 days
```

For the invites collection:
```javascript
db.dm_invites.createIndex({ fromSteamId: 1, toSteamId: 1, status: 1 }, { name: 'invite_lookup' });
```

### Step 2: Verify Indexes

Check if indexes were created:
```javascript
// In MongoDB Compass or Shell
db.chats_2025-01-15.getIndexes();
db.dms_2025-01-15.getIndexes();
db.dm_invites.getIndexes();
```

### Step 3: Monitor Performance

After creating indexes, you should see:
- ✅ Faster message loading
- ✅ Lower database CPU usage
- ✅ Reduced query execution time

## 🔧 API Changes

### Messages Endpoint

**Before:**
```
GET /api/chat/messages?page=2
```

**After:**
```
GET /api/chat/messages?beforeTimestamp=2025-01-15T10:30:00.000Z
```

Response includes:
```json
{
  "messages": [...],
  "hasMore": true,
  "nextCursor": "2025-01-15T09:45:00.000Z"
}
```

### DM Messages Endpoint

**Before:**
```
GET /api/chat/dms?steamId1=...&steamId2=...
```

**After:**
```
GET /api/chat/dms?steamId1=...&steamId2=...&beforeTimestamp=...&limit=500
```

## 📊 Performance Impact

### Before Optimization
- ❌ Collection scans on every query
- ❌ Slow pagination (gets slower with more messages)
- ❌ High network transfer (fetching all fields)
- ❌ Risk of hitting 100 ops/sec limit

### After Optimization
- ✅ Index scans (instant lookup)
- ✅ Fast pagination (constant time)
- ✅ Reduced network transfer (projections)
- ✅ Stays within free tier limits

## 🎯 Best Practices

1. **Run index setup after deployment** - Use the admin API route
2. **Monitor collection sizes** - Keep under 512MB total
3. **Use TTL indexes** - Auto-delete old messages
4. **Region matching** - Deploy in same region as MongoDB cluster
5. **Avoid polling** - Use SSE/WebSockets for real-time updates (already implemented)

## 🐛 Troubleshooting

### Indexes not created?
- Check MongoDB connection string
- Verify admin Steam ID
- Check MongoDB Atlas logs

### Still slow?
- Verify indexes exist: `db.collection.getIndexes()`
- Check query execution: Use MongoDB Compass Explain Plan
- Monitor Atlas metrics for CPU/Memory usage

### Hitting operation limits?
- Reduce polling frequency
- Use cursor pagination (already implemented)
- Consider upgrading to M2 tier if needed

## 📝 Notes

- Indexes are created per collection (date-based)
- New collections need indexes created (can be automated)
- TTL indexes auto-delete old documents
- Cursor pagination works with any collection size

