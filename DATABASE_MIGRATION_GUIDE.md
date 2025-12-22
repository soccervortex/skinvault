# Database Migration Guide

## Overview

This guide shows how to migrate existing KV usage to the new database abstraction layer that supports MongoDB fallback.

---

## Quick Migration Pattern

### Before (Direct KV Usage):
```typescript
import { kv } from '@vercel/kv';

// Read
const data = await kv.get<MyType>('my_key');

// Write
await kv.set('my_key', data);

// Delete
await kv.del('my_key');
```

### After (Database Abstraction):
```typescript
import { dbGet, dbSet, dbDelete } from '@/app/utils/database';

// Read (automatically falls back to MongoDB if KV fails)
const data = await dbGet<MyType>('my_key');

// Write (writes to both KV and MongoDB)
await dbSet('my_key', data);

// Delete (deletes from both)
await dbDelete('my_key');
```

---

## Files Already Migrated

✅ `src/app/utils/pro-storage.ts` - Pro user management

---

## Files to Migrate (Priority Order)

### High Priority (Critical Data)
1. **Purchase History** - `src/app/api/payment/webhook/route.ts`
2. **User Rewards** - `src/app/api/payment/webhook/route.ts`
3. **Discord Connections** - `src/app/api/discord/callback/route.ts`
4. **Price Alerts** - `src/app/api/alerts/create/route.ts`

### Medium Priority
5. **Banned Users** - `src/app/api/admin/ban/route.ts`
6. **Theme Data** - `src/app/utils/theme-storage.ts`
7. **Gift Rewards** - `src/app/utils/gift-storage.ts`

### Low Priority (Can wait)
8. **Wishlist Data** - `src/app/api/wishlist/route.ts`
9. **Other utility functions**

---

## Example Migration: Purchase History

### Before:
```typescript
import { kv } from '@vercel/kv';

const purchasesKey = 'purchase_history';
const existingPurchases = await kv.get<Array<any>>(purchasesKey) || [];
existingPurchases.push(newPurchase);
await kv.set(purchasesKey, existingPurchases);
```

### After:
```typescript
import { dbGet, dbSet } from '@/app/utils/database';

const purchasesKey = 'purchase_history';
const existingPurchases = await dbGet<Array<any>>(purchasesKey) || [];
existingPurchases.push(newPurchase);
await dbSet(purchasesKey, existingPurchases);
```

---

## Example Migration: User Rewards

### Before:
```typescript
import { kv } from '@vercel/kv';

const rewardsKey = 'user_rewards';
const existingRewards = await kv.get<Record<string, any[]>>(rewardsKey) || {};
const userRewards = existingRewards[steamId] || [];
userRewards.push(newReward);
existingRewards[steamId] = userRewards;
await kv.set(rewardsKey, existingRewards);
```

### After:
```typescript
import { dbGet, dbSet } from '@/app/utils/database';

const rewardsKey = 'user_rewards';
const existingRewards = await dbGet<Record<string, any[]>>(rewardsKey) || {};
const userRewards = existingRewards[steamId] || [];
userRewards.push(newReward);
existingRewards[steamId] = userRewards;
await dbSet(rewardsKey, existingRewards);
```

---

## Migration Steps

1. **Find KV Usage**
   ```bash
   grep -r "from '@vercel/kv'" src/app
   grep -r "kv.get" src/app
   grep -r "kv.set" src/app
   ```

2. **Replace Import**
   ```typescript
   // Remove
   import { kv } from '@vercel/kv';
   
   // Add
   import { dbGet, dbSet, dbDelete } from '@/app/utils/database';
   ```

3. **Replace Operations**
   - `kv.get()` → `dbGet()`
   - `kv.set()` → `dbSet()`
   - `kv.del()` → `dbDelete()`

4. **Test**
   - Test with KV available
   - Test with KV disabled (should use MongoDB)
   - Verify data persists

5. **Commit**
   - Commit one file at a time
   - Test after each migration

---

## Benefits After Migration

✅ **Automatic Fallback**: Switches to MongoDB if KV fails  
✅ **Data Redundancy**: Data stored in both databases  
✅ **Rate Limit Protection**: No errors when KV hits limits  
✅ **Zero Downtime**: Seamless switching between databases  
✅ **Backup Built-in**: MongoDB automatically backs up KV data  

---

## Testing Migration

### Test 1: Normal Operation (KV Available)
```typescript
// Should use KV
const data = await dbGet('test_key');
console.log('Status:', getDbStatus()); // Should be 'kv'
```

### Test 2: KV Failure (MongoDB Fallback)
```typescript
// Temporarily break KV connection
// Should automatically use MongoDB
const data = await dbGet('test_key');
console.log('Status:', getDbStatus()); // Should be 'mongodb'
```

### Test 3: Data Persistence
```typescript
// Write data
await dbSet('test_key', { test: 'data' });

// Read back (should work from either database)
const data = await dbGet('test_key');
console.log(data); // Should be { test: 'data' }
```

---

## Notes

- **No Breaking Changes**: Existing code continues to work
- **Gradual Migration**: Migrate files one at a time
- **Backward Compatible**: Old KV code still works (just no fallback)
- **Performance**: No performance impact (MongoDB backup is async)

---

## Need Help?

Check the main setup guide: `DATABASE_BACKUP_SETUP.md`

