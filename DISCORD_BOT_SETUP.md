# Discord Bot Setup Guide

This guide will walk you through setting up and running the SkinVault Discord bot locally.

## 📋 Prerequisites

1. **Node.js** (version 18.0.0 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **Discord Application & Bot**
   - You need a Discord bot token and client ID
   - If you don't have one, see "Creating a Discord Bot" section below

3. **Environment Variables**
   - Create a `.env` file in the project root (same directory as `discord-bot.js`)

## 🔑 Understanding the API Token

The `DISCORD_BOT_API_TOKEN` is an **optional security token** used to authenticate requests between your local bot and the website's API gateway (`/api/discord/bot-gateway`).

- **If set**: The bot must include `Authorization: Bearer <token>` header in requests
- **If empty/not set**: The gateway will accept requests without authentication (less secure)
- **Recommendation**: Set a strong, random token for production use

The token is used in:
- `discord-bot.js` - Bot sends this token when fetching queued messages
- `src/app/api/discord/bot-gateway/route.ts` - Website verifies this token before processing requests

## 🤖 Creating a Discord Bot (If Needed)

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name (e.g., "SkinVault Bot")
3. Go to the "Bot" section in the left sidebar
4. Click "Add Bot" and confirm
5. Under "Token", click "Reset Token" and copy the token (this is your `DISCORD_BOT_TOKEN`)
6. Under "Privileged Gateway Intents", enable:
   - ✅ MESSAGE CONTENT INTENT (required for reading messages)
   - ✅ SERVER MEMBERS INTENT (if needed)
7. Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions: "Send Messages", "Use Slash Commands"
   - Copy the generated URL and use it to invite the bot to your server
8. Copy the "Application ID" from the "General Information" page (this is your `DISCORD_CLIENT_ID`)

## 📝 Environment Variables Setup

Create a `.env` file in the project root with the following variables:

```env
# Required: Discord Bot Credentials
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Required: Website API URL
API_BASE_URL=https://skinvaults.vercel.app

# Optional: API Authentication Token (recommended for security)
# Generate a random secure string, e.g., using: openssl rand -hex 32
DISCORD_BOT_API_TOKEN=your_secure_random_token_here
```

### Generating a Secure API Token

You can generate a secure random token using one of these methods:

**Option 1: Using OpenSSL (Linux/Mac)**
```bash
openssl rand -hex 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 3: Using PowerShell (Windows)**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Option 4: Online Generator**
- Visit: https://randomkeygen.com/
- Use a "CodeIgniter Encryption Keys" or similar

**Important**: If you set `DISCORD_BOT_API_TOKEN` in your `.env` file, you must also add it to your Vercel environment variables:
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add `DISCORD_BOT_API_TOKEN` with the same value

## 📦 Installation

1. **Install Bot Dependencies**

   Navigate to the project root directory and install the bot's dependencies:

   ```bash
   npm install --prefix . discord.js dotenv
   ```

   Or if you have a separate `package-bot.json`:

   ```bash
   npm install
   ```

2. **Verify Installation**

   Check that `discord.js` and `dotenv` are installed:

   ```bash
   npm list discord.js dotenv
   ```

## 🚀 Running the Bot

### Method 1: Direct Run (Production)

```bash
node discord-bot.js
```

### Method 2: Development Mode (with auto-restart)

First, install nodemon globally (optional):
```bash
npm install -g nodemon
```

Then run:
```bash
nodemon discord-bot.js
```

Or use the npm script:
```bash
npm run dev
```

### Expected Output

When the bot starts successfully, you should see:

```
✅ Discord bot logged in as YourBotName#1234!
Bot is in X guild(s)
Started refreshing application (/) commands.
Successfully registered application commands.
🤖 Bot is ready and processing messages!
```

## ✅ Testing the Bot

### Test 1: Bot Online Status

1. Open Discord and check if your bot appears online in your server
2. The bot should show as "Online" with a green status indicator

### Test 2: Slash Commands Registration

1. In Discord, type `/` in any channel
2. You should see the following commands available:
   - `/wishlist` - View your wishlist with current prices
   - `/alerts` - View your active price alerts
   - `/help` - Get help with SkinVault bot commands

### Test 3: Help Command

1. In Discord, type `/help` and press Enter
2. You should receive an embed message with bot information and available commands

### Test 4: Discord Connection (Website)

1. Go to https://skinvaults.online/inventory
2. Sign in with Steam
3. Click "Connect Discord" button
4. Authorize the connection
5. After connection, you should receive a welcome DM from the bot (if the bot is running)

### Test 5: Wishlist Command (Requires Connection)

1. Make sure you've connected your Discord account on the website
2. Add some items to your wishlist on the website
3. In Discord, type `/wishlist` and press Enter
4. You should see an embed with your wishlist items and their prices

### Test 6: Alerts Command (Requires Connection)

1. Make sure you've connected your Discord account on the website
2. Set up a price alert on the website
3. In Discord, type `/alerts` and press Enter
4. You should see an embed with your active price alerts

### Test 7: Price Alert Notification

1. Set up a price alert on the website for an item
2. Wait for the price to trigger the alert (or manually trigger it)
3. You should receive a DM from the bot with the alert notification

## 🔍 Troubleshooting

### Bot Won't Start

**Error: "Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID"**
- Check your `.env` file exists and has the correct variable names
- Verify the values are correct (no extra spaces or quotes)
- Make sure `.env` is in the same directory as `discord-bot.js`

**Error: "Failed to login"**
- Verify your `DISCORD_BOT_TOKEN` is correct
- Check if the bot token was reset (you'll need to update it)
- Ensure the bot is enabled in Discord Developer Portal

### Commands Not Appearing

**Commands don't show up when typing `/`**
- Wait a few minutes for Discord to sync commands (can take up to 1 hour)
- Try restarting Discord client
- Verify `DISCORD_CLIENT_ID` is correct
- Check bot console for "Successfully registered application commands" message

### Bot Not Sending DMs

**Welcome message not received after connecting Discord**
- Check bot console for errors
- Verify bot has permission to send DMs
- Ensure user hasn't blocked the bot
- Check if `API_BASE_URL` is correct in `.env`

**Price alerts not triggering**
- Verify the bot is running and polling the gateway
- Check bot console for errors
- Verify `DISCORD_BOT_API_TOKEN` matches in both `.env` and Vercel (if set)
- Check website console for errors when creating alerts

### API Gateway Errors

**Error: "Unauthorized" (401)**
- If you set `DISCORD_BOT_API_TOKEN`, verify it matches in:
  - Your local `.env` file
  - Vercel environment variables
- If you don't want authentication, leave `DISCORD_BOT_API_TOKEN` empty in both places

**Error: "Failed to fetch queued messages"**
- Verify `API_BASE_URL` is correct
- Check if the website is accessible
- Verify network connectivity

### Bot Keeps Disconnecting

- Check your internet connection
- Verify Discord API status: https://discordstatus.com/
- Check bot console for error messages
- Ensure bot token hasn't been revoked

## 🔐 Security Best Practices

1. **Never commit `.env` file to Git**
   - Add `.env` to `.gitignore`
   - Use environment variables in production (Vercel)

2. **Use Strong API Token**
   - Generate a random, long token (32+ characters)
   - Don't reuse tokens across environments

3. **Rotate Tokens Regularly**
   - Change tokens if compromised
   - Update both local `.env` and Vercel variables

4. **Limit Bot Permissions**
   - Only grant necessary permissions
   - Use bot-specific permissions, not admin

## 📊 Monitoring

### Check Bot Status

The bot logs important events to the console:
- ✅ Bot login success
- 🔄 Command registrations
- 📨 DM sending attempts
- ❌ Errors and warnings

### Monitor Gateway API

Check Vercel logs for:
- Gateway API requests
- Authentication failures
- Queue processing

## 🛠️ Advanced Configuration

### Custom Polling Interval

The bot polls for queued messages every 5 seconds. To change this, edit `discord-bot.js`:

```javascript
// Change from 5000ms (5 seconds) to your desired interval
setInterval(processQueuedMessages, 10000); // 10 seconds
```

### Running as a Service (Linux)

Use `pm2` to run the bot as a background service:

```bash
npm install -g pm2
pm2 start discord-bot.js --name skinvault-bot
pm2 save
pm2 startup
```

### Running on Windows (Background)

Use `node-windows` or Task Scheduler to run the bot as a Windows service.

## 📚 Additional Resources

- Discord.js Documentation: https://discord.js.org/
- Discord Developer Portal: https://discord.com/developers
- Vercel Environment Variables: https://vercel.com/docs/concepts/projects/environment-variables

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check the bot console for error messages
2. Verify all environment variables are set correctly
3. Test the website API endpoints directly
4. Check Discord Developer Portal for bot status
5. Review Vercel logs for API errors

---

**Last Updated**: 2025-01-27
