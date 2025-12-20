# Discord Bot User Install Configuration Checklist

## ✅ Current Configuration Status

### 1. Bot Intents (discord-bot.js)
- ✅ `GatewayIntentBits.DirectMessages` - Enabled (required for DMs)
- ✅ `GatewayIntentBits.Guilds` - Enabled
- ✅ `GatewayIntentBits.GuildMessages` - Enabled
- ✅ `GatewayIntentBits.MessageContent` - Enabled

### 2. Command Registration (discord-bot.js)
- ✅ Commands are registered **globally** using `Routes.applicationCommands(DISCORD_CLIENT_ID)`
- ✅ This works for both server and user installs
- ✅ Commands will appear in DMs and servers

### 3. OAuth Scopes (src/app/api/discord/auth/route.ts)
- ✅ Currently using `['identify']` scope (correct for account linking)
- ⚠️ **Note**: This only links the user's Discord account, it does NOT install the bot

### 4. Bot Installation Flow
- ❌ **MISSING**: Separate bot installation flow for user installs
- ⚠️ **Issue**: Users connect their Discord account via OAuth, but the bot is not installed to their account
- ⚠️ **Impact**: Bot cannot send DMs if not installed to user's account

## 🔧 What Needs to Be Done

### In Discord Developer Portal:
1. **Enable User Install**:
   - Go to https://discord.com/developers/applications
   - Select your application
   - Go to **Installation** section
   - Enable **"User Install"** checkbox
   - This allows users to install the bot directly to their accounts

2. **Verify Bot Permissions**:
   - In **Bot** section, ensure bot has:
     - Send Messages permission
     - Read Message History permission
   - These are required for DMs

3. **Verify OAuth2 Settings**:
   - In **OAuth2** → **URL Generator**:
     - Select scopes: `bot`, `applications.commands` (for bot installation)
     - Select bot permissions: Send Messages, Read Message History
   - This generates the install URL for users

### In Code:
1. **Add Bot Install URL** (if needed):
   - Create a separate endpoint or button for bot installation
   - Use OAuth2 URL Generator with `bot` and `applications.commands` scopes
   - Guide users to install the bot after connecting their account

2. **Alternative: Combined Flow**:
   - Modify OAuth flow to include `bot` and `applications.commands` scopes
   - This would install the bot AND link the account in one step
   - **Note**: This changes the user experience - they'll be installing the bot, not just linking

## 🐛 Current Issue: Welcome Message Not Sending

### Root Cause Analysis:
1. ✅ Callback route is executing (logs show `[Discord Callback] ===== SUCCESS`)
2. ✅ Bot gateway is polling (logs show queue checks)
3. ⚠️ Queue is empty (logs show "No messages in queue")
4. ❓ Queue write might be failing silently OR bot isn't installed

### Possible Issues:
1. **Bot Not Installed**: If bot isn't installed to user's account, DMs will fail
2. **Queue Write Failing**: KV write might be failing (but we added retry logic)
3. **Timing Issue**: Bot might be clearing queue before callback writes to it
4. **User DMs Disabled**: User might have DMs disabled or bot blocked

## 📋 Testing Checklist

### Test 1: Verify Bot Installation
1. Go to Discord Developer Portal
2. Check if "User Install" is enabled
3. Generate install URL with `bot` and `applications.commands` scopes
4. Install bot to your test account
5. Try sending a DM manually from bot code
6. Check if DM is received

### Test 2: Verify OAuth Connection
1. Connect Discord account via website
2. Check Vercel logs for callback execution
3. Check if queue write logs appear
4. Check if bot processes the queue
5. Check if DM is sent

### Test 3: Verify Queue Flow
1. Connect Discord account
2. Check Vercel logs for `[Discord Callback] 📬 STEP 1-9` logs
3. Check bot logs for queue processing
4. Verify message appears in queue
5. Verify bot sends DM

## 🔗 Discord Documentation References

- [User Installable Apps](https://discord.com/developers/docs/tutorials/developing-a-user-installable-app)
- [OAuth2 Scopes](https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes)
- [Bot Permissions](https://discord.com/developers/docs/topics/permissions)

## 💡 Recommendations

1. **Immediate Fix**: Add step-by-step logging (already done) to see where queue process fails
2. **Short-term**: Guide users to install bot after connecting account
3. **Long-term**: Consider combined OAuth flow that installs bot AND links account

## 🎯 Next Steps

1. Check Discord Developer Portal settings
2. Verify "User Install" is enabled
3. Test bot installation manually
4. Review Vercel logs for queue write failures
5. Test DM sending with installed bot

