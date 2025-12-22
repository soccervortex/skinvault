# Database Backup System Setup Guide

## Overview

This system provides automatic database redundancy with MongoDB as a backup/fallback for Vercel KV:

- **Primary Database**: Vercel KV (Redis) - Fast, serverless
- **Backup/Fallback Database**: MongoDB - Persistent, reliable
- **Automatic Switching**: Falls back to MongoDB when KV fails or hits rate limits
- **Bidirectional Sync**: MongoDB backs up KV data, and can restore to KV when it recovers

---

## How It Works

### 1. **Primary Operation (KV Available)**
```
User Request → KV (Primary) → Response
              ↓
         MongoDB (Backup)
```
- All reads/writes go to KV first
- MongoDB automatically backs up all KV data in the background
- Fast performance with KV

### 2. **Fallback Operation (KV Unavailable)**
```
User Request → KV (Failed) → MongoDB (Fallback) → Response
```
- Automatically detects KV failures
- Switches to MongoDB seamlessly
- No data loss - MongoDB has all the backups

### 3. **Recovery (KV Recovers)**
```
KV Recovers → Sync from MongoDB → KV Updated
```
- When KV becomes available again, data syncs back from MongoDB
- Ensures both databases are in sync

---

## Setup Instructions

### Step 1: Get MongoDB Connection String

#### Option A: MongoDB Atlas (Free Tier Recommended)
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a new cluster (Free tier: M0)
4. Click **Connect** → **Connect your application**
5. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)
6. Replace `<password>` with your database password

#### Option B: Local MongoDB (Development)
1. Install MongoDB locally
2. Connection string: `mongodb://localhost:27017/skinvault`

### Step 2: Add Environment Variables

**For Local Development** (`.env.local`):
```env
# Existing KV variables (keep these)
KV_REST_API_URL=https://your-kv-url.upstash.io
KV_REST_API_TOKEN=your-kv-token

# New MongoDB variables
MONGODB_URI=mongodb+srv://skinvaults:YOUR_PASSWORD@cluster0.5ceoi.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=skinvault
```

**Note**: Replace `YOUR_PASSWORD` with your actual MongoDB password, or use the full connection string provided by MongoDB Atlas.

**For Vercel Production**:
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add these variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `MONGODB_DB_NAME` - Database name (default: `skinvault`)
3. Add to **Production**, **Preview**, and **Development** environments

### Step 3: Install Dependencies

The MongoDB package is already installed. If you need to reinstall:
```bash
npm install mongodb
```

### Step 4: Verify Setup

1. Deploy to Vercel (or run locally)
2. Check database health in admin panel or via API:
   ```
   GET /api/admin/db-health
   ```
3. You should see:
   ```json
   {
     "status": "kv",
     "health": {
       "kv": true,
       "mongodb": true
     }
   }
   ```

---

## Automatic Features

### ✅ Rate Limit Detection
- Automatically detects when KV hits rate limits (429 errors)
- Switches to MongoDB immediately
- No user-facing errors

### ✅ Connection Failure Handling
- Detects KV connection failures
- Falls back to MongoDB
- Logs warnings for monitoring

### ✅ Background Backup
- All KV writes are automatically backed up to MongoDB
- No performance impact (async operations)
- Ensures data redundancy

### ✅ Automatic Sync
- When KV recovers, data syncs back from MongoDB
- Ensures both databases stay in sync
- No manual intervention needed

---

## Monitoring

### Check Database Status

**Via Admin Panel:**
- Go to Admin Panel → Database Health (if added to UI)

**Via API:**
```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://your-domain.com/api/admin/db-health
```

**Response:**
```json
{
  "status": "kv",  // or "mongodb" or "fallback"
  "health": {
    "kv": true,
    "mongodb": true
  },
  "kv": {
    "configured": true,
    "available": true
  },
  "mongodb": {
    "configured": true,
    "available": true
  }
}
```

### Logs to Watch

- `[Database] MongoDB connected successfully` - MongoDB is ready
- `[Database] KV rate limit hit, switching to MongoDB` - Rate limit detected
- `[Database] KV unavailable` - KV connection failed
- `[Database] Synced {key} from MongoDB to KV` - Data synced back

---

## Migration from KV-Only

If you're already using KV, the system will:

1. **Automatically detect** existing KV data
2. **Backup to MongoDB** on first write after setup
3. **Continue using KV** as primary (no disruption)
4. **Have MongoDB ready** as fallback

No migration script needed - it happens automatically!

---

## Cost Considerations

### MongoDB Atlas Free Tier
- **512 MB storage** - More than enough for Pro users, purchases, rewards
- **Shared RAM** - Sufficient for backup/fallback use
- **No credit card required** - Free forever

### When You Might Need Paid
- If you exceed 512 MB storage (unlikely for this use case)
- If you need better performance (not needed for backup)
- If you want dedicated resources

**Recommendation**: Free tier is perfect for backup/fallback use case.

---

## Troubleshooting

### MongoDB Connection Failed

**Error**: `MongoDB connection failed`

**Solutions**:
1. Check `MONGODB_URI` is correct
2. Verify MongoDB Atlas IP whitelist (add `0.0.0.0/0` for Vercel)
3. Check database password is correct
4. Verify network connectivity

### KV Still Primary When It Should Fallback

**Check**:
1. KV might still be working (check rate limits)
2. MongoDB might not be configured (`MONGODB_URI` missing)
3. Check logs for specific error messages

### Data Not Syncing

**Check**:
1. Both databases are configured
2. KV is actually failing (not just slow)
3. MongoDB connection is working
4. Check logs for sync messages

---

## Best Practices

1. **Always Configure Both**
   - Even if you only use KV, configure MongoDB as backup
   - It's free and provides safety net

2. **Monitor Database Health**
   - Check `/api/admin/db-health` regularly
   - Set up alerts if both databases fail

3. **Keep MongoDB Updated**
   - MongoDB automatically backs up KV data
   - No manual sync needed

4. **Test Fallback**
   - Temporarily disable KV to test MongoDB fallback
   - Verify data is accessible

---

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│   Database Abstraction Layer    │
│   (src/app/utils/database.ts)   │
└──────┬───────────────────┬───────┘
       │                   │
       ▼                   ▼
┌──────────┐         ┌──────────┐
│   KV     │         │ MongoDB │
│ (Primary)│         │(Backup) │
└──────────┘         └──────────┘
```

---

## Summary

✅ **Automatic**: No manual intervention needed  
✅ **Redundant**: Data stored in both databases  
✅ **Resilient**: Automatically handles failures  
✅ **Free**: MongoDB Atlas free tier is sufficient  
✅ **Transparent**: Works seamlessly with existing code  

Your application now has enterprise-grade database redundancy!

