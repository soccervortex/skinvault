# Discord Webhook Setup Guide

This guide explains how to set up separate Discord channels and webhooks for different notification categories.

## 📋 Categories

The system supports 5 notification categories, each with its own Discord channel:

1. **Users** (`users`) - New user registrations
2. **Pro** (`pro`) - Pro grants (admin) and Pro purchases
3. **Purchases** (`purchases`) - All purchases (Pro and consumables)
4. **Moderation** (`moderation`) - User bans and unbans
5. **Reports** (`reports`) - Chat reports and item reports

## 🔧 Setup Steps

### Step 1: Create Discord Channels

In your Discord server, create channels for each category:

1. Go to your Discord server
2. Create the following channels (or use existing ones):
   - `#users` or `#new-users` - For new user notifications
   - `#pro` or `#pro-users` - For Pro grants and purchases
   - `#purchases` or `#sales` - For all purchase notifications
   - `#moderation` or `#bans` - For ban/unban notifications
   - `#reports` or `#user-reports` - For chat and item reports

### Step 2: Create Webhooks for Each Channel

For each channel, create a webhook:

1. Right-click on the channel → **Edit Channel**
2. Go to **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Give it a name (e.g., "SkinVaults Users", "SkinVaults Pro", etc.)
5. Choose the channel
6. Click **Copy Webhook URL**
7. Save the URL - you'll need it for the environment variables

### Step 3: Configure Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Discord Webhook URLs (one for each category)
# If a category-specific webhook is not set, it will fall back to DISCORD_WEBHOOK_URL

# Default webhook (fallback for all categories)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1455365997094633606/v8N3tDRUekgyGtsquJ8HhXkX2kMVxycoZJLgilvNtLV6TEFsUFUwxJ8YE5Girk5ENdUa

# Category-specific webhooks (optional - will use default if not set)
DISCORD_WEBHOOK_USERS=https://discord.com/api/webhooks/YOUR_USERS_WEBHOOK_URL
DISCORD_WEBHOOK_PRO=https://discord.com/api/webhooks/YOUR_PRO_WEBHOOK_URL
DISCORD_WEBHOOK_PURCHASES=https://discord.com/api/webhooks/YOUR_PURCHASES_WEBHOOK_URL
DISCORD_WEBHOOK_MODERATION=https://discord.com/api/webhooks/YOUR_MODERATION_WEBHOOK_URL
DISCORD_WEBHOOK_REPORTS=https://discord.com/api/webhooks/YOUR_REPORTS_WEBHOOK_URL
```

### Step 4: Replace Placeholder URLs

Replace the placeholder URLs with your actual webhook URLs from Step 2.

**Example:**
```env
DISCORD_WEBHOOK_USERS=https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz1234567890
DISCORD_WEBHOOK_PRO=https://discord.com/api/webhooks/9876543210987654321/zyxwvutsrqponmlkjihgfedcba0987654321
# ... etc
```

## 📊 Notification Flow

### Users Channel
- ✅ New user registrations

### Pro Channel
- ✅ Pro grants (admin console)
- ✅ Pro purchases (Stripe webhook)
- ✅ Pro purchases (manual verification)
- ✅ Pro via gift claims

### Purchases Channel
- ✅ Pro purchases (also sent to Pro channel)
- ✅ Consumable purchases (discord_access, wishlist_slot, price_tracker)

### Moderation Channel
- ✅ User bans
- ✅ User unbans

### Reports Channel
- ✅ Chat reports (global and DM)
- ✅ Item reports (missing items)

## 🔄 Fallback Behavior

If a category-specific webhook URL is not configured, the system will:
1. Use the `DISCORD_WEBHOOK_URL` as a fallback
2. If that's also not set, use the default webhook URL in the code

This ensures notifications always work, even if you haven't set up all channels yet.

## 🎨 Customization

You can customize:
- **Channel names** - Name your Discord channels however you want
- **Webhook names** - Give your webhooks descriptive names
- **Channel permissions** - Control who can see each channel
- **Notifications** - Set up Discord notifications for important channels

## 🧪 Testing

To test if your webhooks are working:

1. Make sure all environment variables are set
2. Restart your application
3. Trigger an event (e.g., register a new user, make a purchase)
4. Check the corresponding Discord channel for the notification

## 📝 Notes

- **Pro purchases** are sent to BOTH `pro` and `purchases` channels
- All webhook calls are non-blocking (failures won't break your app)
- Webhook URLs are kept secure in environment variables
- You can use the same webhook URL for multiple categories if desired

## 🔒 Security

- Never commit webhook URLs to version control
- Keep your `.env.local` file private
- Rotate webhook URLs if they're accidentally exposed
- Use Discord's webhook management to revoke old URLs

