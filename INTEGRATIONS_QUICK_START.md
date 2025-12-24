# Integrations Quick Start Guide

All Vercel Marketplace integrations are now set up and ready to use!

## ✅ What's Installed

1. **Sentry** - Error tracking ✅
2. **Inngest** - Background jobs ✅
3. **Hypertune** - Feature flags ✅
4. **Supabase** - Database (optional) ✅
5. **Upstash** - Already using via Vercel KV ✅
6. **Statsig** - Feature flags (already integrated) ✅
7. **MongoDB Atlas** - Database (already integrated) ✅

---

## 🚀 Quick Usage Examples

### 1. Sentry - Error Tracking

**Already working!** Errors are automatically captured.

**Manual error capture:**
```typescript
import { captureError } from '@/app/lib/error-handler';

try {
  // Your code
} catch (error) {
  captureError(error, {
    userId: steamId,
    action: 'fetch_inventory',
  });
}
```

### 2. Inngest - Background Jobs

**Trigger a background job:**
```typescript
import { sendInngestEvent } from '@/app/lib/inngest';

// After user registers
await sendInngestEvent('user/registered', {
  userId: steamId,
  email: userEmail,
});
```

**Pre-built functions:**
- `checkPriceAlerts` - Runs every 5 minutes
- `sendWelcomeEmail` - Triggers on `user/registered` event
- `processFailedPurchases` - Runs every 6 hours

### 3. Hypertune - Feature Flags

**Check a feature flag:**
```typescript
import { getFeatureFlag } from '@/app/lib/hypertune';

const showNewFeature = await getFeatureFlag('new_feature', steamId);
if (showNewFeature) {
  // Show new feature
}
```

### 4. Supabase - Database (Optional)

**Use Supabase for additional data:**
```typescript
import { getSupabaseClient } from '@/app/lib/supabase';

const supabase = getSupabaseClient();
if (supabase) {
  const { data } = await supabase
    .from('analytics')
    .insert({ user_id: steamId, event: 'page_view' });
}
```

---

## 📋 Environment Variables

All environment variables are automatically added by Vercel integrations. Check your Vercel dashboard → Project → Settings → Environment Variables.

**Required for each integration:**
- **Sentry**: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- **Inngest**: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- **Hypertune**: `HYPERTUNE_API_KEY`
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🎯 Next Steps

1. **Check Sentry Dashboard** - View any errors that occur
2. **Set up Inngest Functions** - Customize background jobs in `src/app/lib/inngest-functions.ts`
3. **Create Hypertune Flags** - Add feature flags in Hypertune dashboard
4. **Optional: Use Supabase** - Set up tables if you want additional database features

---

## 📚 Full Documentation

See `INTEGRATIONS_SETUP.md` for detailed usage and examples.

---

**All integrations are ready to use!** 🎉

