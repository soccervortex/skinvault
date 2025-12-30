# Discord Webhook Testing Guide

## ✅ Your Webhooks Are Configured!

All webhook URLs have been hardcoded in the code with your provided URLs:

- **Users**: `1455368741062967327` ✅
- **Pro**: `1455368871564415142` ✅
- **Purchases**: `1455369022769074432` ✅
- **Moderation**: `1455369157129277686` ✅
- **Reports**: `1455369270765682698` ✅
- **General (fallback)**: `1455365997094633606` ✅

## 🧪 How to Test

### Method 1: Test Endpoint (Recommended)

Use the test endpoint to send test notifications to all channels:

```bash
# Using curl
curl -X GET "http://localhost:3000/api/admin/test-webhooks" \
  -H "x-admin-key: YOUR_ADMIN_PRO_TOKEN"

# Or in your browser (if you're logged in as admin)
# Visit: http://localhost:3000/api/admin/test-webhooks
# Make sure to include the admin key header
```

**Response:**
```json
{
  "success": true,
  "message": "Sent 9 out of 9 test notifications",
  "results": {
    "New User": { "success": true },
    "User Login": { "success": true },
    "Pro Grant": { "success": true },
    "Pro Purchase": { "success": true },
    "Consumable Purchase": { "success": true },
    "User Ban": { "success": true },
    "User Unban": { "success": true },
    "Chat Report": { "success": true },
    "Item Report": { "success": true }
  }
}
```

### Method 2: Test Individual Events

#### Test New User Registration
1. Register a new user (first-time login)
2. Check the **Users** channel in Discord

#### Test User Login
1. Log in with an existing user
2. Check the **Users** channel in Discord

#### Test Pro Grant
1. Go to Admin Console → Pro Management
2. Grant Pro to a user
3. Check the **Pro** channel in Discord

#### Test Pro Purchase
1. Make a Pro purchase through Stripe
2. Check both **Pro** and **Purchases** channels

#### Test Consumable Purchase
1. Purchase a consumable (discord_access, wishlist_slot, etc.)
2. Check the **Purchases** channel

#### Test User Ban
1. Go to Admin Console → User Management
2. Ban a user
3. Check the **Moderation** channel

#### Test User Unban
1. Go to Admin Console → User Management
2. Unban a user
3. Check the **Moderation** channel

#### Test Chat Report
1. Submit a chat report (global or DM)
2. Check the **Reports** channel

#### Test Item Report
1. Report a missing item
2. Check the **Reports** channel

## 📋 What You'll See

Each notification will appear as a Discord embed with:
- **Title** with emoji
- **Description**
- **Color-coded** (green for success, red for bans, etc.)
- **Fields** with relevant information
- **Timestamp** in Discord's relative time format

## 🔍 Troubleshooting

### No notifications appearing?

1. **Check webhook URLs** - Make sure they're correct in the code
2. **Check Discord permissions** - Webhook needs permission to send messages
3. **Check server logs** - Look for webhook errors in console
4. **Test endpoint** - Use the test endpoint to verify all webhooks work

### Some notifications work but others don't?

- Check which category is failing
- Verify the webhook URL for that category
- Check if the webhook was deleted or revoked in Discord

### Test endpoint returns errors?

- Make sure you're using the correct admin key
- Check that the admin key is set in your environment variables
- Verify the endpoint is accessible (not blocked by auth)

## 🎯 Quick Test Checklist

- [ ] Test endpoint works (`/api/admin/test-webhooks`)
- [ ] New user notification appears in Users channel
- [ ] User login notification appears in Users channel
- [ ] Pro grant notification appears in Pro channel
- [ ] Pro purchase appears in both Pro and Purchases channels
- [ ] Consumable purchase appears in Purchases channel
- [ ] Ban notification appears in Moderation channel
- [ ] Unban notification appears in Moderation channel
- [ ] Chat report appears in Reports channel
- [ ] Item report appears in Reports channel

## 📝 Notes

- **Login notifications** are sent for ALL logins (not just first-time)
- **Pro purchases** go to BOTH Pro and Purchases channels
- All webhook calls are **non-blocking** (won't break your app if Discord is down)
- Test notifications use fake Steam IDs (`76561198000000000`) - safe to ignore

## 🚀 Next Steps

Once testing is complete:
1. Monitor your Discord channels for real notifications
2. Set up Discord notifications/alerts for important channels
3. Consider adding more categories if needed (you have all 5 covered!)

