# Quick Vercel Deployment Guide

## Prerequisites
- GitHub account (or GitLab/Bitbucket)
- Your code pushed to a Git repository

## Step 1: Push to GitHub (if not already)

```bash
# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/skin-vault.git
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. **Go to Vercel**: https://vercel.com
2. **Sign up/Login** with GitHub
3. **Click "Add New Project"**
4. **Import your repository**:
   - Select your GitHub account
   - Find `skin-vault` repository
   - Click "Import"
5. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `skin-vault` (if repo is in subfolder) or leave blank
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
6. **Click "Deploy"**

### Option B: Via Vercel CLI (Fastest)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (from project root)
cd d:\Codes\cs2-website\skin-vault
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? (your account)
# - Link to existing project? N
# - Project name? skin-vault
# - Directory? ./
# - Override settings? N
```

## Step 3: Add Environment Variables

Go to your Vercel project → **Settings** → **Environment Variables**

Add these variables:

### Required for KV Storage:
```
KV_REST_API_URL=https://premium-dane-32006.upstash.io
KV_REST_API_TOKEN=AX0GAAIncDEyOWE1N2UwMmQ5OWM0YWRmOGNmZDUyNTZmNzVjNGY1M3AxMzIwMDY
```

### Required for Stripe Payments:
```
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Optional (Admin Panel):
```
ADMIN_PRO_TOKEN=your_secret_admin_key_here
```

**Important**: 
- Add to **Production**, **Preview**, and **Development** environments
- Click "Save" after each variable

## Step 4: Set Up KV Database (If Not Done)

1. Go to your Vercel project → **Storage** tab
2. Click **Browse Storage** → **Marketplace Database Providers**
3. Select **Upstash** (or Redis)
4. Create database and connect to project
5. Copy the credentials to environment variables (Step 3)

## Step 5: Configure Stripe Webhook

1. Go to **Stripe Dashboard** → **Webhooks**
2. Click **Add endpoint**
3. Enter your Vercel URL: `https://your-project.vercel.app/api/payment/webhook`
4. Select event: `checkout.session.completed`
5. Copy the **Signing secret** → Add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`

## Step 6: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger auto-deploy

## Step 7: Verify Deployment

1. Visit your site: `https://your-project.vercel.app`
2. Test login with Steam
3. Test Pro payment flow
4. Check admin panel (if owner)

## Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your domain
3. Follow DNS configuration instructions
4. Vercel handles SSL automatically

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Check for TypeScript errors

### Environment Variables Not Working
- Make sure they're added to **all environments** (Production, Preview, Development)
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### KV Not Working
- Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
- Check Upstash dashboard for database status
- Test locally first with same credentials

### Stripe Webhook Not Working
- Verify webhook URL is correct: `https://your-domain.vercel.app/api/payment/webhook`
- Check webhook secret matches in Vercel env vars
- Test with Stripe CLI locally first

## Quick Commands

```bash
# Deploy to production
vercel --prod

# Preview deployment
vercel

# View logs
vercel logs

# List deployments
vercel ls
```

## Auto-Deploy

Vercel automatically deploys on:
- Push to `main` branch → Production
- Push to other branches → Preview
- Pull requests → Preview deployment

## Performance Tips

- Vercel Edge Network (automatic)
- Image optimization (automatic with Next.js Image)
- Automatic HTTPS
- Global CDN (automatic)

Your site should be live in **2-5 minutes**! 🚀
