# Environment Variables Setup

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Steam API Configuration
```env
# Get your Steam Web API Key from: https://steamcommunity.com/dev/apikey
STEAM_API_KEY=your_steam_api_key_here
```

### Discord OAuth Configuration
```env
# Get these from: https://discord.com/developers/applications
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_CLIENT_SECRET=your_discord_client_secret_here
DISCORD_REDIRECT_URI=https://your-domain.com/api/discord/callback

# Discord Bot API Token (for bot gateway authentication)
# This is a custom token you generate for securing the bot gateway endpoint
DISCORD_BOT_API_TOKEN=your_discord_bot_api_token_here
```

### Stripe Payment Configuration
```env
# Get your Stripe keys from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Email Configuration (Resend)
```env
# Get your API key from: https://resend.com/api-keys
RESEND_API_KEY=re_your_resend_api_key_here
```

### Vercel KV (Upstash Redis) Configuration
```env
# Get these from: https://vercel.com/dashboard → Your Project → Storage → KV
KV_REST_API_URL=https://your-kv-instance.upstash.io
KV_REST_API_TOKEN=your_kv_rest_api_token_here

# Optional (for read-only access if needed)
KV_REST_API_READ_ONLY_TOKEN=your_kv_read_only_token_here
```

### Base URL Configuration
```env
# Set this to your production domain (e.g., https://skinvaults.vercel.app)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Optional: Alternative Proxy Service API Keys
```env
# These are for alternative inventory fetching services if needed
# Steam Web API: https://www.steamwebapi.com/dashboard
STEAM_WEB_API_KEY=your_steam_web_api_key_here

# CS Inventory API: https://csinventoryapi.com/profile
CS_INVENTORY_API_KEY=your_cs_inventory_api_key_here

# CSGO Empire API: https://csgoempire.com/trading/apikey
CSGO_EMPIRE_API_KEY=your_csgo_empire_api_key_here

# SteamApis: https://steamapis.com
STEAMAPIS_KEY=your_steamapis_key_here
```

### Scraping Service API Keys (for reliable proxy services)
```env
# ScraperAPI: https://www.scraperapi.com
SCRAPERAPI_KEY_1=f954ef2d72fbb57dec5d9a8f1c6fd870

# ZenRows: https://www.zenrows.com
ZENROWS_API_KEY=54e690af65971d3121cb5f6564f587054b4e3b31

# ScrapingAnt: https://www.scrapingant.com
SCRAPINGANT_API_KEY_1=33ba01076eb14ecda75b23cb7d6eb95a
SCRAPINGANT_API_KEY_2=94948a3cd6c24d72844137d152942697
SCRAPINGANT_API_KEY_3=59ce5beb2c3a49aeb6b4cc8221213b1b
SCRAPINGANT_API_KEY_4=95ce666ac8664988a3130f2a02929cf9
```

## For Vercel Production

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add all the required environment variables listed above
3. Make sure to add them for **Production**, **Preview**, and **Development** environments

## Security Notes

- **Never commit `.env.local` to version control** - it's already in `.gitignore`
- All API keys should be kept secret and never exposed in client-side code
- Use different keys for development and production environments
- Rotate keys regularly for security

## Notes

- `KV_URL` and `REDIS_URL` are for direct Redis connections (not needed for REST API)
- The `@vercel/kv` package uses the REST API, so you only need `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- If an environment variable is missing, the application will show appropriate error messages
