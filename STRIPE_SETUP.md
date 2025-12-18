# Stripe Payment Setup Guide (Free, No KYC Required for Testing)

## Quick Setup Steps

### 1. Create Stripe Account (Free)
1. Go to https://stripe.com and sign up (free, no credit card needed)
2. Complete basic account setup (email verification only - no KYC for test mode)

### 2. Get Your API Keys
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_...`)
3. Copy your **Secret key** (starts with `sk_test_...`)

### 3. Set Up Environment Variables
Create a `.env.local` file in the project root:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 4. Set Up Webhook (For Automatic Pro Activation)
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter your URL: `https://yourdomain.com/api/payment/webhook`
   - For local testing, use: https://dashboard.stripe.com/test/webhooks (Stripe CLI recommended)
4. Select event: `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_...`) and add it to `.env.local`

### 5. Test Mode vs Live Mode
- **Test Mode**: Free, no KYC needed, use test card numbers
- **Live Mode**: Requires business verification (but still free to set up)

### Test Card Numbers (Test Mode Only)
- Success: `4242 4242 4242 4242`
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC
- Any ZIP code

## Local Development with Webhooks

For local development, use Stripe CLI to forward webhooks:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to localhost:3000/api/payment/webhook`
3. Copy the webhook secret it gives you to `.env.local`

## Going Live (Optional)

When ready for real payments:
1. Switch to Live mode in Stripe dashboard
2. Update API keys in `.env.local` (use `pk_live_...` and `sk_live_...`)
3. Complete business verification (required for live payments)
4. Update webhook URL to your production domain

## Pricing
- Stripe charges: 1.4% + €0.25 per successful card payment (EU)
- No monthly fees
- No setup costs
- Free to test

## Notes
- Test mode is completely free and requires no verification
- You can test the entire payment flow without any real charges
- Pro subscriptions are automatically granted via webhook when payment succeeds
