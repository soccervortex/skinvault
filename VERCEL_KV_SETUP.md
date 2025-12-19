# Vercel KV Setup Guide (Free, Persistent Storage)

## Why KV Storage?

The old `pro-users.json` file gets reset on every Vercel deployment. KV (Redis) provides persistent storage that survives deployments and works perfectly on Vercel.

## Setup Steps

### 1. Create KV Database via Vercel Marketplace (Free)

KV is now available through the Vercel Marketplace. You can use **Upstash** or **Redis** providers:

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Click on your project
3. Go to **Storage** tab (or **Browse Storage**)
4. You'll see a banner: "KV and Postgres are now available through the Marketplace"
5. Scroll to **Marketplace Database Providers**
6. Choose one of these options:
   - **Upstash** - "Serverless DB (Redis, Vector, Queue, Search)" - Recommended
   - **Redis** - "Serverless Redis"
7. Click on your chosen provider
8. Follow the setup wizard to create a free Redis database
9. Connect it to your Vercel project

### 2. Get Your KV Credentials

After creating the KV database through the Marketplace:

**For Upstash:**
1. Go to your Upstash dashboard (or through Vercel integration)
2. Find your Redis database
3. Go to **REST API** section
4. Copy these environment variables:
   - `KV_REST_API_URL` (Upstash REST URL)
   - `KV_REST_API_TOKEN` (Upstash REST Token)

**For Redis (via Marketplace):**
1. Go to your Redis database settings in Vercel
2. Find the **Connection** or **Environment Variables** section
3. Copy the REST API credentials provided

### 3. Add to Your Environment Variables

**For Local Development:**
Add to your `.env.local` file:
```env
KV_REST_API_URL=https://your-redis-url.upstash.io
KV_REST_API_TOKEN=your-token-here
```

**For Vercel Production:**
1. If you connected the database through Vercel Marketplace, the environment variables may be automatically added
2. If not, go to your Vercel project → **Settings** → **Environment Variables**
3. Add these variables:
   - `KV_REST_API_URL` (from your Redis provider)
   - `KV_REST_API_TOKEN` (from your Redis provider)

### 4. Migrate Existing Data (Optional)

If you have existing Pro users in `pro-users.json`, you can migrate them:

1. Make sure your `.env.local` has the KV credentials
2. Run the migration script (we'll create this if needed)
3. Or manually add them through the admin panel

## How It Works

- **Local Development**: Uses in-memory fallback if KV is not configured
- **Vercel Production**: Uses Redis (via Marketplace) for persistent storage
- **Data Persists**: Survives deployments, restarts, and scaling
- **Free Tier**: 
  - **Upstash**: 10,000 commands/day, 256 MB storage (free tier)
  - **Redis (Marketplace)**: Check provider's free tier limits
  - More than enough for Pro users data

## Migration from JSON File

The system automatically falls back to in-memory storage if KV is not configured, so you can:

1. Set up KV on Vercel
2. Add environment variables
3. Existing Pro users will be stored in KV going forward
4. Old JSON file is no longer used (but kept for reference)

## Testing

1. Grant Pro to a test user via admin panel
2. Check that it persists after restarting the dev server
3. Deploy to Vercel and verify it works in production

## Cost

- **Upstash Free Tier**: 10,000 commands/day, 256 MB storage
- **Redis (Marketplace)**: Check individual provider's free tier
- **Paid Plans**: Vary by provider if you exceed free tier
- For Pro users data, free tier is more than sufficient

## Important Notes

- KV is now accessed through the **Vercel Marketplace**, not as a direct Vercel storage option
- **Upstash** is recommended as it's specifically designed for serverless and works seamlessly with Vercel
- The `@vercel/kv` package works with any Redis-compatible REST API (Upstash, Redis Cloud, etc.)
- Your code doesn't need to change - it will work with any Redis provider that supports REST API
