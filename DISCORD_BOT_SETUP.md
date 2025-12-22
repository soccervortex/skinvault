# Discord Bot Setup Guide - Fixing "Unknown Integration" Error

## Problem: "Unknown Integration" Error

If you see "Unknown Integration" when using Discord bot commands, this usually means one of the following:

1. **Bot is not installed** - You need to install the bot first
2. **Commands not propagated** - Global commands can take up to 1 hour to appear
3. **Bot not configured for user installs** - Bot needs to be configured in Discord Developer Portal
4. **Bot is offline** - The bot process is not running

## Solution Steps

### 1. Enable User Installs in Discord Developer Portal

1. Go to https://discord.com/developers/applications
2. Select your bot application
3. Go to **Installation** tab (left sidebar)
4. Under **Install Link**, make sure:
   - **User Install** is **ENABLED** ✅
   - **Guild Install** can be enabled or disabled (optional)
5. Under **Scopes**, make sure these are selected:
   - ✅ `applications.commands` (REQUIRED for slash commands)
   - ✅ `bot` (if you want server installs too)
6. Under **Bot Permissions**, select:
   - ✅ Send Messages
   - ✅ Use Slash Commands
   - ✅ Read Message History
   - ✅ Send Messages in Threads
   - ✅ Use External Emojis
   - ✅ Use External Stickers

### 2. Verify Bot Configuration

1. Go to **General Information** tab
2. Make sure:
   - Bot is **Public** (if you want anyone to install it)
   - Or add your Discord user ID to **Team Members** if private

### 3. Re-register Commands

The bot automatically registers commands on startup. To force re-registration:

1. Restart your Discord bot (stop and start the `discord-bot.js` process)
2. Check the bot logs - you should see:
   ```
   ✅ Successfully registered application commands globally.
   📋 Commands registered: /wishlist, /help, /alerts, ...
   ```

### 4. Wait for Command Propagation

- **Global commands** can take up to **1 hour** to appear in Discord
- If commands don't appear immediately, wait up to 1 hour
- Commands will appear in:
  - Direct Messages (DMs) with the bot
  - Servers where the bot is present

### 5. Install the Bot (User Install) - **REQUIRED**

**IMPORTANT:** Users MUST install the bot before they can use commands!

**Option A: Via Install Link**
1. Go to **Installation** tab in Discord Developer Portal
2. Copy the **Install Link** (should have `integration_type=1` for user installs)
3. Share this link with users, OR
4. Users can click the link to install the bot

**Option B: Via Website**
1. Go to https://skinvaults.online/inventory
2. Sign in with Steam
3. Click "Connect Discord" button
4. This will install the bot automatically

**After Installation:**
- Wait up to 1 hour for commands to appear
- Commands will work in DMs with the bot
- Commands will work in servers where the bot is present

### 6. Test Commands

After installation and waiting for propagation:

1. Open Discord
2. Go to DMs or a server with the bot
3. Type `/` and you should see the bot's commands
4. If you still see "Unknown Integration":
   - Wait up to 1 hour for global commands to propagate
   - Make sure the bot is online and running
   - Check bot logs for errors

## Troubleshooting

### Commands Not Appearing

- **Wait up to 1 hour** - Global commands take time to propagate
- **Restart the bot** - This forces command re-registration
- **Check bot logs** - Look for registration errors
- **Verify scopes** - Must have `applications.commands` scope

### Still Getting "Unknown Integration"

1. **Uninstall and reinstall the bot:**
   - Go to Discord Settings → Authorized Apps
   - Find your bot and click "Revoke Access"
   - Reinstall using the install link

2. **Check bot status:**
   - Make sure the bot process is running
   - Check bot logs for connection errors
   - Verify `DISCORD_BOT_TOKEN` is correct

3. **Verify command registration:**
   - Check bot logs for: `✅ Successfully registered application commands globally`
   - If you see errors, fix them and restart the bot

4. **Discord Cache:**
   - Close Discord completely
   - Reopen Discord
   - Try commands again

## Required Environment Variables

Make sure these are set in your bot's environment:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
API_BASE_URL=https://skinvaults.online
DISCORD_BOT_API_TOKEN=your_api_token_here
```

## Command Registration

The bot registers these commands globally:
- `/wishlist` - View your wishlist
- `/help` - Get help
- `/alerts` - View price alerts
- `/inventory` - View inventory
- `/price` - Check item price
- `/vault` - View vault value
- `/stats` - View CS2 stats
- `/player` - Search for player
- `/compare` - Compare skins
- `/pro` - Check Pro status
- `/shop` - View shop
- `/website` - Get website link

All commands are registered on bot startup. Check logs to verify registration.

## Support

If issues persist:
1. Check Discord Developer Portal settings
2. Verify bot is online and running
3. Check bot logs for errors
4. Wait up to 1 hour for command propagation
5. Try uninstalling and reinstalling the bot
