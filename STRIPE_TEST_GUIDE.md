# Testing Stripe Payments Without Editing Environment Variables

## Quick Test Method

### Option 1: Use Test Checkout Endpoint (Recommended)

We've created a special test endpoint that accepts test keys in the request body, so you don't need to modify your environment variables.

**Test Endpoint:** `/api/payment/test-checkout`

#### How to Use:

1. **Get your Stripe test keys:**
   - Go to https://dashboard.stripe.com/test/apikeys
   - Copy your **Test Secret Key** (starts with `sk_test_...`)
   - Copy your **Test Publishable Key** (starts with `pk_test_...`)

2. **Test via API directly:**
   ```bash
   curl -X POST http://localhost:3000/api/payment/test-checkout \
     -H "Content-Type: application/json" \
     -d '{
       "plan": "1month",
       "steamId": "76561199052427203",
       "testSecretKey": "sk_test_your_test_key_here"
     }'
   ```

3. **Or modify your frontend temporarily:**
   Update the checkout call in `src/app/pro/page.tsx` to use the test endpoint:
   ```typescript
   const res = await fetch('/api/payment/test-checkout', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       plan, 
       steamId: user.steamId, 
       promoCode,
       testSecretKey: 'sk_test_your_key_here',  // Add this
       testPublishableKey: 'pk_test_your_key_here'  // Optional
     }),
   });
   ```

### Option 2: Use Stripe CLI (For Webhook Testing)

1. **Install Stripe CLI:**
   ```bash
   # Windows (via Scoop or download)
   scoop install stripe
   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe CLI:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server:**
   ```bash
   stripe listen --forward-to localhost:3000/api/payment/webhook
   ```
   
   This will give you a webhook secret (starts with `whsec_...`). You can use this temporarily in your `.env.local` just for testing, or pass it as a header.

4. **Trigger test events:**
   ```bash
   # Trigger a test payment
   stripe trigger checkout.session.completed
   ```

### Option 3: Use Vercel Preview Deployments

1. **Create a preview branch:**
   ```bash
   git checkout -b test/stripe-test
   ```

2. **Add test keys to Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `STRIPE_SECRET_KEY` with your test key (starts with `sk_test_...`)
   - Add `STRIPE_WEBHOOK_SECRET` (get from Stripe Dashboard → Webhooks → Add endpoint)
   - Set these for **Preview** environment only

3. **Deploy preview:**
   ```bash
   git push origin test/stripe-test
   ```
   
   Vercel will create a preview deployment with test keys.

4. **Test on preview URL:**
   - Use the preview deployment URL
   - Test payments won't affect production

## Test Card Numbers

Use these in Stripe test mode:

| Card Number | Result |
|------------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Card declined |
| `4000 0025 0000 3155` | 🔐 Requires authentication |
| `4000 0000 0000 9995` | ❌ Insufficient funds |

- **Expiry:** Any future date (e.g., 12/34)
- **CVC:** Any 3 digits (e.g., 123)
- **ZIP:** Any ZIP code (e.g., 12345)

## Testing Webhooks Locally

### Method 1: Stripe CLI (Easiest)

```bash
# Terminal 1: Start your dev server
npm run dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/api/payment/webhook

# Terminal 3: Trigger test payment
stripe trigger checkout.session.completed
```

### Method 2: Stripe Dashboard Webhook Testing

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Send test webhook"
3. Select event: `checkout.session.completed`
4. Copy the webhook payload
5. Manually POST to your local endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/payment/webhook \
     -H "stripe-signature: test_signature" \
     -H "Content-Type: application/json" \
     -d @webhook_payload.json
   ```

## Important Notes

⚠️ **Test Mode vs Live Mode:**
- Test keys (`sk_test_...`) work only in test mode
- Test payments don't charge real money
- Test webhooks need to be configured separately
- Test data is separate from live data

✅ **Best Practice:**
- Use test keys for development
- Use the test checkout endpoint for quick testing
- Use Stripe CLI for webhook testing
- Never commit test keys to git

## Quick Test Script

Create a file `test-stripe.js`:

```javascript
// Quick test script
const testCheckout = async () => {
  const response = await fetch('http://localhost:3000/api/payment/test-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: '1month',
      steamId: '76561199052427203', // Your test Steam ID
      testSecretKey: 'sk_test_YOUR_KEY_HERE'
    })
  });
  
  const data = await response.json();
  console.log('Checkout URL:', data.url);
  console.log('Open this URL to test payment');
};

testCheckout();
```

Run with: `node test-stripe.js`

