# SkinVault - Premium CS2 Skin Analytics Platform

A high-performance Next.js application for tracking CS2 (Counter-Strike 2) skin inventories, prices, and analytics with Pro subscription features including Discord price alerts.

## 🚀 Features

### Free Tier
- Basic inventory tracking
- Price monitoring (3 proxies)
- Limited wishlist (10 items)
- Standard caching

### Pro Tier
- **Direct Steam API Access** - Live prices, no proxies needed
- **Priority API Requests** - Faster response times
- **10 Proxies** - Better reliability for fallback
- **Unlimited Wishlist** - Add as many items as you want
- **Discord Price Alerts** - Get notified when prices hit your targets
- **Advanced Statistics** - Detailed analytics and comparisons
- **Early Access** - New features first

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Vercel account (for deployment)
- Vercel KV database (for Pro user storage)
- Discord Application & Bot (for price alerts)
- Stripe account (for payments)

## 🛠️ Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/soccervortex/skinvault.git
cd skinvault
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Base URL
NEXT_PUBLIC_BASE_URL=https://skinvaults.vercel.app

# Vercel KV (Database for Pro users)
KV_REST_API_URL=https://your-kv-instance.upstash.io
KV_REST_API_TOKEN=your-kv-token

# Discord OAuth & Bot
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_REDIRECT_URI=https://skinvaults.online/api/discord/callback

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Email (for contact form)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 3. Vercel KV Setup

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project → Storage → Create Database
3. Select "KV" (Key-Value)
4. Copy the `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your `.env.local`

### 4. Discord Application Setup

#### Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "SkinVault Bot"
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the **Bot Token** → `DISCORD_BOT_TOKEN`
7. Enable these Privileged Gateway Intents:
   - ✅ MESSAGE CONTENT INTENT (if needed)
   - ✅ SERVER MEMBERS INTENT (if needed)

#### OAuth2 Setup

1. Go to "OAuth2" → "General"
2. Copy **Client ID** → `DISCORD_CLIENT_ID`
3. Click "Reset Secret" and copy → `DISCORD_CLIENT_SECRET`
4. Add Redirect URI:
   - Development: `https://skinvaults.online/api/discord/callback`
   - Production: `https://yourdomain.com/api/discord/callback`
5. Scopes needed:
   - `identify` (to get user info)

#### Bot Permissions

1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - `bot`
   - `identify`
3. Select bot permissions:
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ Use Slash Commands (if using)
4. Copy the generated URL (optional, for manual bot invite)

### 5. Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your **Publishable Key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Get your **Secret Key** → `STRIPE_SECRET_KEY`
4. Set up Webhook:
   - Go to Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/payment/webhook`
   - Select events: `checkout.session.completed`
   - Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

### 6. Run Development Server

```bash
npm run dev
```

The Discord bot will automatically initialize when the server starts. You should see:
```
✅ Discord bot initialized: YourBotName#1234
```

### 7. Build for Production

```bash
npm run build
npm start
```

## 🏗️ Architecture

### Pro User Benefits

1. **Direct Steam API Access**
   - Pro users bypass proxies and get direct Steam API access
   - Faster response times (no proxy delays)
   - Live, real-time prices
   - Implemented in `src/app/utils/proxy-utils.ts`

2. **Priority API Requests**
   - Pro requests are marked with `Priority: high` header
   - Server-side API route handles direct Steam requests
   - Fallback to proxies if direct API fails

3. **Discord Price Alerts**
   - Users connect Discord via OAuth2
   - Create price alerts for specific items
   - Bot sends DMs when prices hit targets
   - All alerts stored in Vercel KV

### File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── discord/          # Discord OAuth & connection
│   │   ├── alerts/            # Price alert management
│   │   ├── steam/price/       # Direct Steam API for Pro users
│   │   └── user/pro/          # Pro status checking
│   ├── components/
│   │   ├── DiscordConnection.tsx  # Discord OAuth UI
│   │   └── PriceAlerts.tsx        # Price alert management UI
│   ├── services/
│   │   └── discord-bot.ts        # Discord bot service
│   ├── lib/
│   │   └── discord-bot-init.ts   # Bot initialization
│   └── utils/
│       └── proxy-utils.ts         # Pro-based proxy selection
```

## 🔧 How It Works

### Pro Price Fetching Flow

1. **Pro User Request**:
   ```
   Client → fetchWithProxyRotation(steamUrl, isPro=true)
   ```

2. **Direct Steam API** (Pro only):
   ```
   → /api/steam/price?url=...
   → Direct fetch to Steam (server-side, no CORS)
   → Returns live price data
   ```

3. **Price Alert Check** (background):
   ```
   → /api/alerts/check
   → Checks all alerts for this item
   → Sends Discord DM if triggered
   ```

4. **Fallback** (if direct API fails):
   ```
   → Uses 10 proxies (Pro) or 3 proxies (Free)
   ```

### Discord Bot Integration

The Discord bot runs **automatically** with the Next.js server:

1. **Initialization**: `src/app/lib/discord-bot-init.ts` runs on server startup
2. **Bot Service**: `src/app/services/discord-bot.ts` handles all Discord operations
3. **Price Alerts**: Checked automatically when prices are fetched
4. **DM Sending**: Bot creates DM channels and sends notifications

### Price Alert System

1. User connects Discord via OAuth2
2. User creates price alert (Pro only)
3. Alert stored in Vercel KV
4. When price is fetched, alerts are checked
5. If triggered, Discord bot sends DM
6. Alert marked as triggered

## 📝 API Endpoints

### Discord
- `GET /api/discord/auth?steamId=...` - Get Discord OAuth URL
- `GET /api/discord/callback` - OAuth callback
- `GET /api/discord/status?steamId=...` - Check connection status
- `POST /api/discord/disconnect` - Disconnect Discord

### Price Alerts
- `POST /api/alerts/create` - Create price alert (Pro only)
- `GET /api/alerts/list?steamId=...` - List user's alerts
- `POST /api/alerts/delete` - Delete alert
- `POST /api/alerts/check` - Check alerts (internal)

### Steam
- `GET /api/steam/price?url=...` - Direct Steam API (Pro priority)

## 🚨 Troubleshooting

### Discord Bot Not Working

1. Check `DISCORD_BOT_TOKEN` is set correctly
2. Verify bot has proper permissions
3. Check server logs for initialization message
4. Ensure bot is in a server (if using server-based features)

### Price Alerts Not Sending

1. Verify Discord is connected: `/api/discord/status`
2. Check Vercel KV is accessible
3. Verify bot token is valid
4. Check server logs for errors

### Direct Steam API Failing

1. Pro users fallback to proxies automatically
2. Check `/api/steam/price` endpoint logs
3. Verify Steam API is accessible from server

## 🔐 Security Notes

- Discord tokens are stored encrypted in Vercel KV
- OAuth state tokens expire after 10 minutes
- Pro status verified on every request
- All API routes validate user permissions

## 📦 Deployment

### Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

The Discord bot will automatically start when Vercel deploys your app.

### Environment Variables in Vercel

Add all variables from `.env.local` to Vercel:
- Settings → Environment Variables
- Add for Production, Preview, and Development

## 🎯 Pro Features Summary

✅ **Direct Steam API** - Live prices, fastest possible  
✅ **Priority Requests** - High-priority headers  
✅ **10 Proxies** - Better reliability  
✅ **Discord Alerts** - Real-time price notifications  
✅ **Unlimited Wishlist** - No limits  
✅ **Advanced Stats** - Detailed analytics  
✅ **Early Access** - New features first  

## 📄 License

Private - All rights reserved

## 🤝 Support

For issues or questions, contact through the website's contact page.

---

**Built with Next.js 16, TypeScript, Vercel KV, Discord API, and Stripe**
