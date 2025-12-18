# Deploy to Vercel via CLI (No GitHub Connection Needed)

## Quick Deploy Steps

### 1. Login to Vercel
```bash
vercel login
```
This will open your browser to authenticate.

### 2. Deploy to Production
```bash
vercel --prod
```

### 3. Follow the Prompts
- Set up and deploy? **Y**
- Which scope? (select your account)
- Link to existing project? **N** (first time)
- Project name? **skin-vault** (or your preferred name)
- Directory? **./** (current directory)
- Override settings? **N**

### 4. Add Environment Variables
After first deploy, add environment variables:

**Option A: Via Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add all required variables

**Option B: Via CLI**
```bash
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
```

### 5. Redeploy with Environment Variables
```bash
vercel --prod
```

## Your Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```
KV_REST_API_URL=https://premium-dane-32006.upstash.io
KV_REST_API_TOKEN=AX0GAAIncDEyOWE1N2UwMmQ5OWM0YWRmOGNmZDUyNTZmNzVjNGY1M3AxMzIwMDY
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

Make sure to add them for **Production**, **Preview**, and **Development** environments.

## After Deployment

1. Your site will be live at: `https://your-project.vercel.app`
2. Update Stripe webhook URL to: `https://your-project.vercel.app/api/payment/webhook`
3. Test the site!

## Useful Commands

```bash
# Deploy to production
vercel --prod

# Preview deployment
vercel

# View logs
vercel logs

# List deployments
vercel ls

# View project info
vercel inspect
```
