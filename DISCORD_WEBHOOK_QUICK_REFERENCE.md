# Discord Webhook Quick Reference

## 🎯 What You Need to Create

Create **5 Discord channels** and **5 webhooks** (one for each category):

### 1. Users Channel
- **Channel Name**: `#users` or `#new-users`
- **Purpose**: New user registrations
- **Webhook Name**: "SkinVaults Users"
- **Environment Variable**: `DISCORD_WEBHOOK_USERS`

### 2. Pro Channel
- **Channel Name**: `#pro` or `#pro-users`
- **Purpose**: Pro grants (admin) and Pro purchases
- **Webhook Name**: "SkinVaults Pro"
- **Environment Variable**: `DISCORD_WEBHOOK_PRO`

### 3. Purchases Channel
- **Channel Name**: `#purchases` or `#sales`
- **Purpose**: All purchases (Pro and consumables)
- **Webhook Name**: "SkinVaults Purchases"
- **Environment Variable**: `DISCORD_WEBHOOK_PURCHASES`

### 4. Moderation Channel
- **Channel Name**: `#moderation` or `#bans`
- **Purpose**: User bans and unbans
- **Webhook Name**: "SkinVaults Moderation"
- **Environment Variable**: `DISCORD_WEBHOOK_MODERATION`

### 5. Reports Channel
- **Channel Name**: `#reports` or `#user-reports`
- **Purpose**: Chat reports and item reports
- **Webhook Name**: "SkinVaults Reports"
- **Environment Variable**: `DISCORD_WEBHOOK_REPORTS`

## ✅ Webhooks Configured!

Your webhook URLs are already hardcoded in the code. No environment variables needed!

However, if you want to override them, you can add these to your `.env.local`:

```env
# Optional: Override webhook URLs (if not set, uses hardcoded defaults)
DISCORD_WEBHOOK_USERS=https://discord.com/api/webhooks/YOUR_USERS_WEBHOOK_ID/YOUR_TOKEN
DISCORD_WEBHOOK_PRO=https://discord.com/api/webhooks/YOUR_PRO_WEBHOOK_ID/YOUR_TOKEN
DISCORD_WEBHOOK_PURCHASES=https://discord.com/api/webhooks/YOUR_PURCHASES_WEBHOOK_ID/YOUR_TOKEN
DISCORD_WEBHOOK_MODERATION=https://discord.com/api/webhooks/YOUR_MODERATION_WEBHOOK_ID/YOUR_TOKEN
DISCORD_WEBHOOK_REPORTS=https://discord.com/api/webhooks/YOUR_REPORTS_WEBHOOK_ID/YOUR_TOKEN
```

**Current configured webhooks:**
- Users: `1455368741062967327` ✅
- Pro: `1455368871564415142` ✅
- Purchases: `1455369022769074432` ✅
- Moderation: `1455369157129277686` ✅
- Reports: `1455369270765682698` ✅

## 🚀 Quick Setup Steps

1. ✅ **Webhooks are already configured!** (hardcoded in the code)
2. **Test the webhooks** using the test endpoint: `/api/admin/test-webhooks`
3. **Monitor your Discord channels** for notifications

That's it! The system will automatically route notifications to the correct channels.

## 📊 Notification Mapping

| Event | Channel(s) |
|-------|-----------|
| New user registration | `users` |
| User login | `users` |
| Pro grant (admin) | `pro` |
| Pro purchase | `pro` + `purchases` |
| Consumable purchase | `purchases` |
| User ban | `moderation` |
| User unban | `moderation` |
| Chat report | `reports` |
| Item report | `reports` |

## 💡 Tips

- You can use the same webhook URL for multiple categories if you want everything in one channel
- If you don't set a category-specific webhook, it will use the default `DISCORD_WEBHOOK_URL`
- Pro purchases go to both `pro` and `purchases` channels (so you can track Pro separately and all purchases together)

