# Database Sync Explanation

## How KV and MongoDB Stay in Sync

### ✅ **1. Writes (dbSet) - ALWAYS Write to Both**

When something happens on the site (user purchases, Pro granted, etc.):

```typescript
dbSet('pro_users', data)
```

**What happens:**
1. ✅ **Always writes to KV** (if available)
2. ✅ **Always writes to MongoDB** (if configured)
3. ✅ Both writes happen in parallel (don't wait for each other)
4. ✅ If KV fails → MongoDB still gets the data
5. ✅ If MongoDB fails → KV still gets the data
6. ✅ If KV was down but recovers during write → Triggers full sync from MongoDB

**Result:** Both databases always have the latest data.

---

### ✅ **2. Reads (dbGet) - KV First, MongoDB Fallback**

When reading data:

```typescript
const data = await dbGet('pro_users')
```

**What happens:**
1. ✅ **Tries KV first** (fast)
2. ✅ If KV succeeds → Also syncs to MongoDB in background (ensures backup)
3. ✅ If KV fails (rate limit/outage) → Falls back to MongoDB
4. ✅ If reading from MongoDB and KV is available → **Immediately syncs back to KV**
5. ✅ If KV just recovered → Triggers full sync from MongoDB

**Result:** Always get data, and KV gets updated when it recovers.

---

### ✅ **3. Automatic Recovery Sync**

**When KV recovers from rate limit/outage:**

The system automatically detects when KV becomes available again:

1. ✅ **Detection:** Tracks previous KV availability state
2. ✅ **Trigger:** When `isKVAvailable()` changes from `false` → `true`
3. ✅ **Action:** Automatically calls `syncAllDataToKV()` in background
4. ✅ **Result:** All MongoDB data (including new writes while KV was down) syncs back to KV

**This happens automatically during:**
- Any `dbGet()` call (when KV recovers)
- Any `dbSet()` call (when KV recovers)
- Health check calls (`checkDbHealth()`)

---

### ✅ **4. Full Sync Function**

The `syncAllDataToKV()` function:

1. ✅ Gets all MongoDB collections (each = one KV key)
2. ✅ For each collection, reads the value
3. ✅ Writes it to KV
4. ✅ Skips system collections
5. ✅ Reports success/failure counts

**Called automatically when:**
- KV recovers (detected during `isKVAvailable()`)
- Manual trigger via `/api/admin/db-sync`

---

## Example Scenarios

### Scenario 1: Normal Operation
```
User purchases Pro
→ dbSet('pro_users', data)
→ ✅ Written to KV
→ ✅ Written to MongoDB
→ Both databases in sync
```

### Scenario 2: KV Rate Limit Hit
```
User purchases Pro
→ dbSet('pro_users', data)
→ ❌ KV fails (rate limit)
→ ✅ Written to MongoDB
→ System continues using MongoDB
→ Data is safe in MongoDB
```

### Scenario 3: KV Recovers
```
KV was down, now available again
→ Next dbGet() or dbSet() call
→ isKVAvailable() detects recovery
→ ✅ Automatically triggers syncAllDataToKV()
→ All MongoDB data syncs back to KV
→ Both databases in sync again
```

### Scenario 4: Read While KV Down
```
User views inventory
→ dbGet('pro_users')
→ ❌ KV fails
→ ✅ Reads from MongoDB
→ ✅ Syncs back to KV immediately (if KV available)
→ If KV just recovered → Full sync triggered
```

---

## Key Features

✅ **Always Write to Both:** Every write goes to both KV and MongoDB  
✅ **Automatic Fallback:** Seamlessly switches to MongoDB when KV fails  
✅ **Automatic Recovery:** Detects when KV recovers and syncs everything back  
✅ **No Data Loss:** MongoDB always has a backup, even if KV fails  
✅ **Background Sync:** Syncs don't block user requests  
✅ **Per-Key Sync:** Individual keys sync immediately when read from MongoDB  
✅ **Full Sync:** All MongoDB data syncs when KV recovers  

---

## Verification

You can verify sync status:

```bash
# Check database health
GET /api/admin/db-health
Headers: x-admin-key: YOUR_ADMIN_KEY

# Manually trigger full sync
POST /api/admin/db-sync
Headers: x-admin-key: YOUR_ADMIN_KEY

# Compare KV and MongoDB
GET /api/admin/migrate-kv-to-mongodb
Headers: x-admin-key: YOUR_ADMIN_KEY
```

---

## Summary

**Yes, the system ensures:**
1. ✅ **Writes go to both** KV and MongoDB
2. ✅ **Falls back to MongoDB** when KV hits limit
3. ✅ **Automatically syncs MongoDB → KV** when KV recovers
4. ✅ **KV gets all missing data** that was written to MongoDB while KV was down

Both databases stay in sync automatically! 🎉

