# Vercel Marketplace Integrations Setup

This document explains how to use the integrated services from the Vercel Marketplace.

## Installed Integrations

1. **Sentry** - Error tracking and monitoring
2. **Inngest** - Background jobs and scheduled tasks
3. **Hypertune** - Feature flags and experimentation
4. **Supabase** - Optional database and authentication
5. **Upstash** - Already using via Vercel KV
6. **Statsig** - Feature flags (already integrated)
7. **MongoDB Atlas** - Database (already integrated)

---

## 1. Sentry (Error Tracking)

### Setup
Environment variables are automatically added by Vercel integration.

### Usage

#### Server-Side (API Routes)
```typescript
import { captureError, captureMessage } from '@/app/lib/error-handler';

try {
  // Your code
} catch (error) {
  captureError(error, {
    userId: steamId,
    action: 'fetch_inventory',
    metadata: { steamId, itemCount: items.length }
  });
}
```

#### Client-Side
```typescript
import * as Sentry from '@sentry/nextjs';

try {
  // Your code
} catch (error) {
  Sentry.captureException(error);
}
```

#### Automatic Error Tracking
Errors are automatically captured in:
- API routes
- Server components
- Client components (via ErrorBoundary)

### View Errors
- Go to your Sentry dashboard
- Errors appear automatically with stack traces, user context, and metadata

---

## 2. Inngest (Background Jobs)

### Setup
Environment variables are automatically added by Vercel integration.

### Usage

#### Trigger a Background Job
```typescript
import { sendInngestEvent } from '@/app/lib/inngest';

// Send an event to trigger a background job
await sendInngestEvent('user/registered', {
  userId: steamId,
  email: userEmail,
});
```

#### Create New Functions
Edit `src/app/lib/inngest-functions.ts`:

```typescript
export const myNewFunction = inngest.createFunction(
  { id: 'my-function' },
  { event: 'my/event' }, // or { cron: '0 * * * *' } for scheduled
  async ({ event, step }) => {
    return await step.run('do-work', async () => {
      // Your background job logic
      return { success: true };
    });
  }
);
```

Then add it to `src/app/api/inngest/route.ts`:

```typescript
import { myNewFunction } from '@/app/lib/inngest-functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkPriceAlerts,
    myNewFunction, // Add here
  ],
});
```

### Pre-built Functions
- **checkPriceAlerts** - Checks price alerts every 5 minutes
- **sendWelcomeEmail** - Sends welcome email to new users
- **processFailedPurchases** - Processes failed purchases every 6 hours

### View Jobs
- Go to your Inngest dashboard
- See function runs, logs, and status

---

## 3. Hypertune (Feature Flags)

### Setup
Environment variables are automatically added by Vercel integration.

### Usage

#### Server-Side
```typescript
import { getFeatureFlag, getExperimentConfig } from '@/app/lib/hypertune';

// Check if feature is enabled
const isNewFeatureEnabled = await getFeatureFlag('new_feature', steamId);

// Get experiment configuration
const experiment = await getExperimentConfig('pro_conversion_test', steamId);
const variant = experiment.variant; // 'control' or 'variant_a'
```

### Create Flags in Hypertune Dashboard
1. Go to your Hypertune dashboard
2. Create feature flags or experiments
3. Use the flag names in your code

---

## 4. Supabase (Optional Database)

### Setup
Environment variables are automatically added by Vercel integration.

### Usage

#### Database Operations
```typescript
import { getSupabaseClient } from '@/app/lib/supabase';

const supabase = getSupabaseClient();
if (supabase) {
  // Insert data
  const { data, error } = await supabase
    .from('users')
    .insert({ steam_id: steamId, name: userName });
  
  // Query data
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('steam_id', steamId);
}
```

#### Authentication (Alternative to Steam)
```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});
```

---

## 5. Upstash (Redis)

You're already using Upstash via Vercel KV. The `@upstash/redis` package is installed if you need direct Redis access.

### Usage
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

await redis.set('key', 'value');
const value = await redis.get('key');
```

---

## Integration Status

| Integration | Status | Environment Variables |
|------------|--------|---------------------|
| Sentry | ✅ Configured | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` |
| Inngest | ✅ Configured | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| Hypertune | ✅ Configured | `HYPERTUNE_API_KEY` |
| Supabase | ✅ Configured | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Upstash | ✅ Already using (via Vercel KV) | `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
| Statsig | ✅ Already configured | `STATSIG_SERVER_SECRET_KEY`, `NEXT_PUBLIC_STATSIG_CLIENT_KEY` |
| MongoDB Atlas | ✅ Already configured | MongoDB connection string |

---

## Best Practices

1. **Error Handling**: Always use `captureError()` for errors
2. **Background Jobs**: Use Inngest for long-running tasks
3. **Feature Flags**: Use Hypertune or Statsig for gradual rollouts
4. **Monitoring**: Check Sentry dashboard regularly
5. **Testing**: Test integrations in development before production

---

## Troubleshooting

### Sentry not capturing errors
- Check `SENTRY_DSN` is set
- Verify `instrumentation.ts` exists
- Check Sentry dashboard for configuration

### Inngest functions not running
- Check `INNGEST_EVENT_KEY` is set
- Verify functions are registered in `/api/inngest/route.ts`
- Check Inngest dashboard for function status

### Hypertune flags not working
- Check `HYPERTUNE_API_KEY` is set
- Verify flags exist in Hypertune dashboard
- Check flag names match exactly

---

## Next Steps

1. **Set up Sentry**: View errors in dashboard
2. **Create Inngest functions**: Add background jobs for price alerts
3. **Create Hypertune flags**: Set up A/B tests
4. **Optional Supabase**: Use if you need additional database features

All integrations are ready to use! 🚀

