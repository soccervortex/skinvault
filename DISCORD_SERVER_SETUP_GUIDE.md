# SkinVaults Discord Server Setup Guide
## Complete Step-by-Step Guide to Build the Best Community Discord Server

---

## 📋 Table of Contents
1. [Initial Server Setup](#1-initial-server-setup)
2. [Channel Structure](#2-channel-structure)
3. [Roles & Permissions](#3-roles--permissions)
4. [Bots & Automation](#4-bots--automation)
5. [Moderation Setup](#5-moderation-setup)
6. [Community Features](#6-community-features)
7. [Integration with Website](#7-integration-with-website)
8. [Engagement Strategies](#8-engagement-strategies)
9. [Launch Checklist](#9-launch-checklist)

---

## 1. Initial Server Setup

### Step 1.1: Create the Server
1. Open Discord and click the "+" icon on the left sidebar
2. Choose "Create My Own" → "For a club or community"
3. Name it: **"SkinVaults Community"** or **"SkinVaults CS2"**
4. Upload a server icon (use your website logo or a CS2-themed design)
5. Choose your region (closest to your main audience)

### Step 1.2: Server Settings - Overview
1. Right-click server name → **Server Settings**
2. **Server Name**: SkinVaults Community
3. **Server Icon**: Upload high-quality logo (512x512px recommended)
4. **Server Description**: 
   ```
   The official Discord community for SkinVaults - Your CS2 skin tracking and inventory management platform. Join to discuss skins, get price alerts, share your inventory, and connect with the CS2 community!
   ```
5. **Verification Level**: Set to **Medium** (requires verified email)
6. **Default Notification Settings**: Set to **Mentions Only** (prevents spam)

### Step 1.3: Server Settings - Safety
1. Go to **Safety** tab
2. **Auto-Moderation**: Enable
   - **Spam**: Medium
   - **Profanity**: Medium
   - **Sexual Content**: High
   - **Slurs**: High
3. **Verification Level**: Medium
4. **Raids**: Enable "Raider Protection" if available

### Step 1.4: Server Settings - Community
1. Enable **Community Server** (this unlocks many features)
2. **Welcome Screen**: 
   - Title: "Welcome to SkinVaults!"
   - Description: "Join our CS2 community to track skins, get alerts, and connect with traders!"
   - Add channels: #welcome, #rules, #announcements
3. **Server Discovery**: Enable if you want to be discoverable (optional)

---

## 2. Channel Structure

### Step 2.1: Create Category Structure

Create these categories in order:

#### 📢 **INFORMATION** (Top category)
- **#welcome** - Welcome channel with rules and info
- **#announcements** - Important updates and news
- **#rules** - Server rules and guidelines
- **#faq** - Frequently asked questions
- **#server-info** - Server information and links

#### 💬 **GENERAL** (Main chat)
- **#general** - Main community chat
- **#trading** - CS2 skin trading discussions
- **#price-discussion** - Price talks and market analysis
- **#showcase** - Show off your inventory/skins

#### 🎮 **CS2 GAMING**
- **#gameplay** - CS2 gameplay discussions
- **#team-finder** - Find teammates
- **#clips** - Share your best plays
- **#esports** - Pro scene discussions

#### 📊 **SKINVAULTS FEATURES**
- **#price-alerts** - Automated price alerts (bot channel)
- **#inventory-updates** - Inventory sync notifications
- **#feature-requests** - Suggest new features
- **#bug-reports** - Report issues with the website

#### 🎨 **CREATIVE**
- **#screenshots** - Share screenshots
- **#artwork** - CS2-related art
- **#memes** - CS2 memes (keep it clean)

#### 🎯 **ACTIVITIES**
- **#events** - Community events and tournaments
- **#giveaways** - Giveaway announcements
- **#contests** - Community contests

#### 💡 **SUPPORT**
- **#support** - Get help with the website
- **#technical-help** - Technical issues
- **#suggestions** - Feature suggestions

#### 🔊 **VOICE CHANNELS**
- **General Voice** - Casual voice chat
- **Trading Voice** - Trading discussions
- **Gaming Voice** - While playing CS2
- **AFK** - Auto-move inactive users

### Step 2.2: Channel Permissions Setup

For each channel category, set up permissions:

**#welcome, #announcements, #rules**:
- Everyone: Read Messages ✅, Send Messages ❌
- Staff roles: Full permissions ✅

**#general, #trading, #price-discussion**:
- Everyone: Read Messages ✅, Send Messages ✅, Attach Files ✅
- Prevent @everyone mentions

**#price-alerts, #inventory-updates** (Bot channels):
- Everyone: Read Messages ✅
- Only bots can send messages

**#support, #bug-reports**:
- Everyone: Read Messages ✅, Send Messages ✅
- Staff: Can manage messages

---

## 3. Roles & Permissions

### Step 3.1: Create Role Hierarchy

Create roles in this order (top = highest priority):

1. **@Owner** (You)
   - Administrator: ✅
   - Color: Red or Gold

2. **@Admin**
   - Administrator: ✅
   - Color: Red

3. **@Moderator**
   - Manage Messages: ✅
   - Kick Members: ✅
   - Ban Members: ✅
   - Manage Channels: ✅ (for their category)
   - Color: Orange

4. **@Helper** (Community helpers)
   - Manage Messages: ✅ (in support channels)
   - Color: Green

5. **@VIP** (Special members, early supporters)
   - Priority speaker in voice
   - Special color
   - Access to #vip channel (optional)

6. **@Pro Member** (Users with Pro subscription)
   - Access to #pro-features channel
   - Special badge/color
   - Priority support

7. **@Verified** (Verified website users)
   - Basic verified status
   - Color: Blue

8. **@Member** (Default role for everyone)
   - Basic permissions
   - Color: Default

9. **@Muted** (Punishment role)
   - Send Messages: ❌ (in all channels)
   - Add Reactions: ❌

### Step 3.2: Role Assignment Setup

1. **Auto-Role Bot**: Set up MEE6 or Carl-bot to auto-assign @Member role
2. **Verification**: Create a verification system (see bots section)
3. **Pro Member Sync**: Set up bot to sync Pro status from website (if possible)

---

## 4. Bots & Automation

### Step 4.1: Essential Bots to Add

#### **MEE6** (Moderation & Auto-Moderation)
1. Go to https://mee6.xyz
2. Add to server
3. Configure:
   - **Auto-Moderation**: Enable spam, links, caps, mentions
   - **Auto-Role**: Assign @Member role on join
   - **Welcome Messages**: In #welcome channel
   - **Levels**: Enable XP system (optional)
   - **Logs**: Log moderation actions

#### **Carl-bot** (Advanced Moderation)
1. Go to https://carl.gg
2. Add to server
3. Configure:
   - **Auto-Moderation**: Advanced filters
   - **Reaction Roles**: For verification
   - **Starboard**: For highlighting great messages
   - **Logging**: Detailed logs

#### **Dyno** (Moderation & Utility)
1. Go to https://dyno.gg
2. Add to server
3. Configure:
   - **Auto-Moderation**: Custom filters
   - **Auto-Role**: Role management
   - **Custom Commands**: Create custom commands
   - **Music**: If you want music (optional)

#### **Ticket Tool** or **Ticket Tool** (Support Tickets)
1. Go to https://tickettool.xyz or similar
2. Add to server
3. Configure:
   - Create ticket channel: #support
   - Auto-assign staff roles
   - Close ticket command

#### **Top.gg Bot** (Server Stats)
1. Add server to top.gg
2. Get voting rewards set up
3. Display server stats

### Step 4.2: Custom Bot for Website Integration

**You'll need to create a custom Discord bot** to:
- Post price alerts from your website
- Sync user roles (Pro members)
- Post inventory updates
- Post announcements from your X/Twitter

**Steps to create custom bot:**
1. Go to https://discord.com/developers/applications
2. Click "New Application" → Name it "SkinVaults Bot"
3. Go to "Bot" tab → Click "Add Bot"
4. Copy the **Bot Token** (keep it secret!)
5. Enable these **Privileged Gateway Intents**:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions:
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Manage Messages (if needed)
9. Copy the generated URL and open it to add bot to your server

**Add bot to your website code** (later):
- Use Discord.js or discord.py
- Post to #price-alerts when price changes
- Post to #announcements when you post on X
- Sync Pro member roles

---

## 5. Moderation Setup

### Step 5.1: Auto-Moderation Rules

**MEE6 Auto-Moderation:**
1. **Spam Detection**: 
   - Max messages: 5 per 10 seconds
   - Action: Delete + Warn

2. **Link Filtering**:
   - Block all links except in #trading, #showcase
   - Whitelist: skinvaults.online, steamcommunity.com

3. **Caps Filter**:
   - Max caps: 70% of message
   - Action: Delete

4. **Mention Spam**:
   - Max mentions: 3 per message
   - Action: Delete + Mute for 10 minutes

5. **Bad Words**:
   - Add custom word list
   - Action: Delete + Warn

### Step 5.2: Moderation Commands Setup

**MEE6 Commands:**
- `!warn @user reason` - Warn a user
- `!mute @user time` - Mute a user
- `!kick @user reason` - Kick a user
- `!ban @user reason` - Ban a user
- `!clear number` - Delete messages

### Step 5.3: Logging Channel

Create **#mod-logs** channel:
- Only moderators can see it
- Logs all moderation actions
- Logs member joins/leaves
- Logs role changes

---

## 6. Community Features

### Step 6.1: Welcome System

**Welcome Channel Setup:**
1. Create embed message in #welcome with:
   - Server rules
   - How to get verified
   - Important links
   - Channel guide

2. **Welcome Message Template:**
   ```
   🎉 Welcome to SkinVaults Community, {user}!
   
   📋 Please read #rules
   ✅ Get verified in #verify
   🔗 Visit our website: skinvaults.online
   
   Enjoy your stay! 🎮
   ```

### Step 6.2: Verification System

**Reaction Role Verification:**
1. Create #verify channel
2. Post message: "React with ✅ to verify and get access!"
3. Set up Carl-bot or MEE6 reaction role:
   - Emoji: ✅
   - Role: @Verified or @Member

**Or Manual Verification:**
- Users post their Steam profile link
- Moderators verify and assign role

### Step 6.3: Leveling System (Optional)

**MEE6 Levels:**
1. Enable XP system
2. Set XP per message: 15-25
3. Set cooldown: 60 seconds
4. Create role rewards:
   - Level 5: @Bronze
   - Level 10: @Silver
   - Level 20: @Gold
   - Level 50: @Platinum

### Step 6.4: Starboard

**Carl-bot Starboard:**
1. Enable starboard
2. Set channel: #starboard
3. Set threshold: 5 ⭐ reactions
4. Highlights great messages/achievements

### Step 6.5: Giveaway System

**MEE6 Giveaways:**
1. Enable giveaway commands
2. Use command: `!giveaway #channel duration prize`
3. Auto-announce winners

---

## 7. Integration with Website

### Step 7.1: Discord OAuth Integration

**On your website:**
1. Add "Connect Discord" button in user settings
2. Use Discord OAuth2 to link accounts
3. Store Discord user ID in database
4. Show Discord username on profile

### Step 7.2: Automated Discord Posts

**Price Alerts:**
- When price changes >15% in 24h
- Post to #price-alerts channel
- Format: Embed with item image, old price, new price, change %

**New User Welcome:**
- When new user joins website
- Post to #general: "Welcome @username to SkinVaults!"

**Weekly/Monthly Stats:**
- Post weekly summary to #announcements
- Post monthly stats to #announcements

**X/Twitter Sync:**
- When you post on X, also post to #announcements
- Use webhook or bot

### Step 7.3: Role Sync

**Pro Member Role:**
- When user subscribes to Pro → Give @Pro Member role
- When subscription expires → Remove role
- Check daily via cron job

**Verified Role:**
- When user verifies account → Give @Verified role
- Link Discord account in user settings

---

## 8. Engagement Strategies

### Step 8.1: Daily Engagement

**Daily Activities:**
- Post daily skin highlight in #general
- Share interesting price movements
- Ask questions to spark discussion
- Share CS2 news/updates

### Step 8.2: Weekly Events

**Weekly Schedule:**
- **Monday**: Weekly market summary
- **Wednesday**: Feature spotlight
- **Friday**: Community showcase (best inventories)
- **Sunday**: Weekly wrap-up

### Step 8.3: Contests & Giveaways

**Monthly Contests:**
- Best inventory screenshot
- Most creative skin combo
- Best price prediction
- Community member of the month

**Giveaways:**
- CS2 skins
- Pro subscriptions
- Discord Nitro
- Gift cards

### Step 8.4: Community Highlights

**Feature Community Members:**
- Member of the week
- Best trader
- Most helpful member
- Early supporter spotlight

---

## 9. Launch Checklist

### Pre-Launch (Before Opening)

- [ ] All channels created and organized
- [ ] All roles created with proper permissions
- [ ] Rules channel filled with clear rules
- [ ] FAQ channel with common questions
- [ ] Welcome message set up
- [ ] Verification system working
- [ ] Moderation bots configured
- [ ] Auto-moderation enabled
- [ ] Moderation logs set up
- [ ] Staff roles assigned
- [ ] Custom bot added (if ready)
- [ ] Server icon and banner uploaded
- [ ] Server description filled
- [ ] Invite link created (permanent, no expiry)

### Launch Day

- [ ] Post announcement on X/Twitter
- [ ] Post on Reddit (r/GlobalOffensive, r/cs2)
- [ ] Share on your website
- [ ] Welcome first members personally
- [ ] Monitor for issues
- [ ] Answer questions actively

### Post-Launch (First Week)

- [ ] Daily engagement posts
- [ ] Monitor moderation
- [ ] Gather feedback
- [ ] Adjust rules if needed
- [ ] Fix any bot issues
- [ ] Plan first event/giveaway

---

## 10. Advanced Features (Future)

### Step 10.1: Discord Slash Commands

Create custom commands:
- `/price [item]` - Get current price
- `/inventory [user]` - View user's inventory
- `/alert [item] [price]` - Set price alert
- `/stats` - Get your stats

### Step 10.2: Voice Channel Integration

- CS2 game status integration
- Voice channel for active traders
- Tournament voice channels

### Step 10.3: Webhook Integration

- Website → Discord webhooks for:
  - New user registrations
  - Price alerts
  - Feature updates
  - System status

---

## 📝 Important Notes

1. **Start Small**: Don't create too many channels at once. Start with essentials and add more as community grows.

2. **Moderation is Key**: Set up auto-moderation from day 1 to prevent spam and toxic behavior.

3. **Engagement**: Be active yourself! Respond to messages, ask questions, share updates.

4. **Feedback**: Listen to your community and adjust based on their needs.

5. **Integration**: The Discord server should complement your website, not replace it.

6. **Patience**: Building a community takes time. Don't expect thousands of members overnight.

---

## 🔗 Useful Resources

- **Discord Developer Portal**: https://discord.com/developers
- **Discord.js Documentation**: https://discord.js.org
- **MEE6 Dashboard**: https://mee6.xyz
- **Carl-bot Dashboard**: https://carl.gg
- **Discord Server Templates**: Search Discord for templates

---

## 🎯 Next Steps After Setup

1. **Create the server** following steps 1-2
2. **Set up bots** (step 4)
3. **Configure moderation** (step 5)
4. **Launch** (step 9)
5. **Integrate with website** (step 7) - This will require coding
6. **Engage daily** (step 8)

---

**Good luck building your Discord community! 🚀**

If you need help with the custom bot integration code later, I can help with that!

