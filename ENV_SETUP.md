# Environment Variables Setup

## Required for KV Storage (Upstash Redis)

Add these to your `.env.local` file:

```env
KV_REST_API_URL=https://premium-dane-32006.upstash.io
KV_REST_API_TOKEN=AX0GAAIncDEyOWE1N2UwMmQ5OWM0YWRmOGNmZDUyNTZmNzVjNGY1M3AxMzIwMDY
```

## Optional (for read-only access if needed)

```env
KV_REST_API_READ_ONLY_TOKEN=An0GAAIgcDHLLz8SXNtM5w-hdHdY6ebuRODdU3YWQ7wuCWCySoxAQw
```

## For Vercel Production

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add the same `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables
3. Make sure to add them for **Production**, **Preview**, and **Development** environments

## Note

- `KV_URL` and `REDIS_URL` are for direct Redis connections (not needed for REST API)
- The `@vercel/kv` package uses the REST API, so you only need `KV_REST_API_URL` and `KV_REST_API_TOKEN`
