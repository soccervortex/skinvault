# Environment Variables Reference for MongoDB Backup

## Required Environment Variables

Add these to your `.env.local` file for local development:

```env
# Existing KV variables (keep these)
KV_REST_API_URL=https://your-kv-url.upstash.io
KV_REST_API_TOKEN=your-kv-token

# MongoDB Backup/Fallback Database (NEW - Lines 6-7)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/skinvault?retryWrites=true&w=majority
MONGODB_DB_NAME=skinvault
```

## MongoDB Connection String Format

Your `MONGODB_URI` should look like:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

### Example:
```
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/skinvault?retryWrites=true&w=majority
```

## How to Get Your MongoDB URI

1. Go to MongoDB Atlas: https://cloud.mongodb.com
2. Select your cluster (e.g., "Cluster0")
3. Click **"Connect"** button
4. Choose **"Connect your application"**
5. Copy the connection string
6. Replace `<password>` with your database password
7. Replace `<database>` with `skinvault` (or your preferred name)

## For Vercel Production

Add the same variables in Vercel:
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add:
   - `MONGODB_URI` (your connection string)
   - `MONGODB_DB_NAME` (default: `skinvault`)
3. Add to **Production**, **Preview**, and **Development** environments

## Important Notes

- **Never commit `.env.local`** to git (it's in `.gitignore`)
- **Keep your MongoDB password secure**
- **Use different passwords** for development and production
- **MongoDB Atlas free tier** is sufficient for backup/fallback use

## Testing

After adding the variables:
1. Restart your dev server: `npm run dev`
2. Check database health: `GET /api/admin/db-health`
3. You should see both KV and MongoDB as available

