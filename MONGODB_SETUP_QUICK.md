# MongoDB Setup - Quick Reference

## Your MongoDB Configuration

```env
MONGODB_URI=mongodb+srv://skinvaults:System1153@cluster0.5ceoi.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=skinvault
```

## Setup Steps

### 1. Add to Local Development (`.env.local`)

Add these lines to your `.env.local` file:

```env
MONGODB_URI=mongodb+srv://skinvaults:System1153@cluster0.5ceoi.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=skinvault
```

### 2. Add to Vercel Production

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add these variables:
   - **Name**: `MONGODB_URI`
   - **Value**: `mongodb+srv://skinvaults:System1153@cluster0.5ceoi.mongodb.net/?appName=Cluster0`
   - **Environment**: Production, Preview, Development
   
   - **Name**: `MONGODB_DB_NAME`
   - **Value**: `skinvault`
   - **Environment**: Production, Preview, Development

3. Click **Save** for each variable

### 3. Configure MongoDB Atlas IP Whitelist

**Important**: Allow Vercel to connect to your MongoDB cluster.

1. Go to MongoDB Atlas → **Network Access**
2. Click **Add IP Address**
3. Add `0.0.0.0/0` (allows all IPs - required for Vercel)
   - Or add specific Vercel IP ranges if you prefer
4. Click **Confirm**

### 4. Verify Connection

After deploying, check database health:

```bash
# Via API
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://your-domain.com/api/admin/db-health
```

Or check in your admin panel if you add a database health section.

## Expected Behavior

Once configured:

✅ **Writes**: Data goes to both KV and MongoDB  
✅ **Reads**: Uses KV first, falls back to MongoDB if KV fails  
✅ **Sync**: Automatically syncs MongoDB → KV when KV recovers  
✅ **Backup**: MongoDB always has a copy of KV data  

## Collection Structure

MongoDB will create a collection called `kv_data` with documents like:

```json
{
  "_id": "...",
  "key": "pro_users",
  "value": { "7656119...": "2026-01-01T00:00:00.000Z" },
  "updatedAt": "2025-12-22T05:30:00.000Z"
}
```

## Troubleshooting

### Connection Failed
- Check MongoDB Atlas → Network Access (IP whitelist)
- Verify connection string is correct
- Check database user password

### No Data in MongoDB
- Check if writes are happening (check logs)
- Verify `MONGODB_URI` is set correctly
- Check MongoDB Atlas → Collections → `kv_data`

### Sync Not Working
- Check if KV is available: `/api/admin/db-health`
- Manually trigger sync: `POST /api/admin/db-sync`

## Security Note

⚠️ **Important**: Your connection string contains credentials. Never commit it to Git. Always use environment variables.

