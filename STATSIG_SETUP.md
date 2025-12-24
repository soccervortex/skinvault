# Statsig Integration Setup

Statsig is integrated for feature flags, A/B testing, and experimentation.

## What is Statsig?

Statsig is a feature flagging and experimentation platform that allows you to:
- **Feature Flags**: Gradually roll out new features
- **A/B Testing**: Test different versions of features
- **Experimentation**: Run experiments to optimize conversion rates
- **Analytics**: Track user behavior and feature usage

## Setup Instructions

### 1. Get Your Statsig Keys

From your Vercel Statsig integration dashboard:
- **Server Secret Key**: For server-side API routes
- **Client Key**: For browser/client-side code

Or get them from: https://statsig.com

### 2. Add Environment Variables

Add to your `.env.local` and Vercel environment variables:

```env
# Server-side key (for API routes)
STATSIG_SERVER_SECRET_KEY=secret-your-statsig-server-secret-key

# Client-side key (for browser)
NEXT_PUBLIC_STATSIG_CLIENT_KEY=client-your-statsig-client-key
```

### 3. Usage Examples

#### Server-Side (API Routes)

```typescript
import { checkGate, getExperiment, logEvent } from '@/app/lib/statsig';

// Check if a feature is enabled
const isNewFeatureEnabled = await checkGate(
  { userID: steamId },
  'new_feature_gate'
);

// Get experiment configuration
const experiment = await getExperiment(
  { userID: steamId },
  'pro_subscription_test'
);

// Log events for analytics
await logEvent(
  { userID: steamId },
  'pro_subscription_clicked',
  undefined,
  { source: 'homepage' }
);
```

#### Client-Side (React Components)

```typescript
'use client';
import { useGate, useExperiment, logEvent } from '@/app/lib/statsig-client';

function MyComponent({ userId }: { userId: string }) {
  // Check if feature is enabled
  const showNewFeature = useGate('new_feature_gate', userId);
  
  // Get experiment config
  const experiment = useExperiment('pro_subscription_test', userId);
  
  const handleClick = () => {
    logEvent('button_clicked', undefined, { button: 'pro' }, userId);
  };
  
  return (
    <div>
      {showNewFeature && <NewFeature />}
      {experiment.showNewButton && <button onClick={handleClick}>New Button</button>}
    </div>
  );
}
```

## Use Cases for SkinVaults

### 1. A/B Testing Pro Subscription Conversion

Test different pricing displays, CTA buttons, or messaging:

```typescript
const experiment = await getExperiment(
  { userID: steamId, custom: { isPro: false } },
  'pro_conversion_test'
);

// Show different pricing based on experiment
const pricingDisplay = experiment.variant === 'variant_a' 
  ? <PricingDisplayA /> 
  : <PricingDisplayB />;
```

### 2. Feature Flags for New Features

Gradually roll out new features:

```typescript
const showFaceitStats = await checkGate(
  { userID: steamId },
  'faceit_stats_enabled'
);
```

### 3. Experimentation on UI/UX

Test different layouts, colors, or user flows:

```typescript
const uiExperiment = useExperiment('inventory_layout_test', userId);
const layout = uiExperiment.layout === 'grid' ? <GridLayout /> : <ListLayout />;
```

### 4. Analytics Tracking

Track important user actions:

```typescript
await logEvent(
  { userID: steamId },
  'wishlist_item_added',
  undefined,
  { item_name: itemName, item_price: price }
);
```

## Creating Experiments in Statsig Dashboard

1. Go to your Statsig dashboard
2. Create a new **Experiment** or **Feature Gate**
3. Define your variants/conditions
4. Set target metrics (e.g., Pro subscription conversion)
5. Deploy and monitor results

## Best Practices

1. **Always have defaults**: If Statsig fails, your app should still work
2. **Log important events**: Track user actions for analysis
3. **Use user context**: Pass user ID and custom attributes for better targeting
4. **Monitor experiments**: Check Statsig dashboard regularly
5. **Clean up**: Remove old experiments after they're done

## Resources

- [Statsig Documentation](https://docs.statsig.com)
- [Vercel Statsig Integration](https://vercel.com/integrations/statsig)
- [Statsig Dashboard](https://statsig.com)

