const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, SlashCommandBuilder, ActivityType, PresenceUpdateStatus } = require('discord.js');
require('dotenv').config();

// Helper: timestamped logs
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const API_BASE_URL = process.env.API_BASE_URL || 'https://www.skinvaults.online';
const API_TOKEN = process.env.DISCORD_BOT_API_TOKEN || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1453751539792347304'; // SkinVaults Community server

// Owner Steam IDs (from owner-ids.ts)
const OWNER_STEAM_IDS = [
  '76561199235618867', // Original owner
  '76561199052427203', // Co-owner (TheRembler)
  '76561198750974604', // Bot Website (Skinvaults)
];

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  log('❌ ERROR: Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in environment variables');
  process.exit(1);
}

log('🚀 Starting Discord bot...');
log(`📋 Guild ID: ${GUILD_ID}`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // Required for member join events
  ],
});

function UpdatePresence() {
  if (!client?.user) return;
  client.user.setPresence({
    activities: [
      {
        name: 'https://skinvaults.online',
        type: ActivityType.Watching,
      },
    ],
    status: PresenceUpdateStatus.Idle,
  });
}

// Register slash commands
// Note: For User Installs, commands must be registered globally and the bot must have
// "applications.commands" scope. Global commands can take up to 1 hour to appear.
const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server and website chat.')
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the ban').setRequired(false))
    .setDefaultMemberPermissions(0) // Admin/owner only
    .toJSON(),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user on the server and website chat.')
    .addUserOption(option => option.setName('user').setDescription('The user to timeout').setRequired(true))
    .addIntegerOption(option => 
      option.setName('duration')
        .setDescription('Duration of the timeout in minutes')
        .setRequired(true)
        .addChoices(
          { name: '1 Minute', value: 1 },
          { name: '5 Minutes', value: 5 },
          { name: '10 Minutes', value: 10 },
          { name: '1 Hour', value: 60 },
          { name: '1 Day', value: 1440 },
          { name: '1 Week', value: 10080 }
        ))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the timeout').setRequired(false))
    .setDefaultMemberPermissions(0) // Admin/owner only
    .toJSON(),
    new SlashCommandBuilder()
    .setName('banadmin')
    .setDescription('Ban a user from the server and website chat. (Bot Owner only)')
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the ban').setRequired(false))
    .setDefaultMemberPermissions(0) // Admin/owner only
    .toJSON(),
  new SlashCommandBuilder()
    .setName('timeoutadmin')
    .setDescription('Timeout a user on the server and website chat. (Bot Owner only)')
    .addUserOption(option => option.setName('user').setDescription('The user to timeout').setRequired(true))
    .addIntegerOption(option => 
      option.setName('duration')
        .setDescription('Duration of the timeout in minutes')
        .setRequired(true)
        .addChoices(
          { name: '1 Minute', value: 1 },
          { name: '5 Minutes', value: 5 },
          { name: '10 Minutes', value: 10 },
          { name: '1 Hour', value: 60 },
          { name: '1 Day', value: 1440 },
          { name: '1 Week', value: 10080 }
        ))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the timeout').setRequired(false))
    .setDefaultMemberPermissions(0) // Admin/owner only
    .toJSON(),
  new SlashCommandBuilder()
    .setName('credits')
    .setDescription('Check your website credits balance.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward case.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('giveaways')
    .setDescription('View and enter active giveaways.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get an invite to the official support server.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('spins')
    .setDescription('Use your daily spin to win credits.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('View your wishlist with current prices')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Get an invite link to add SkinVaults bot to your server')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with SkinVaults bot commands')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('alerts')
    .setDescription('View your active price alerts')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your inventory summary and stats')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('Check the current price of a CS2 skin')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('The name of the item to check')
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('vault')
    .setDescription('View your total vault value and statistics')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your CS2 player statistics')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('player')
    .setDescription('Search for a player by Steam ID, Discord username, or Steam username')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Steam64 ID, Discord username, or Steam username')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Platform to search on')
        .setRequired(true)
        .addChoices(
          { name: 'Steam64 ID', value: 'steam64' },
          { name: 'Steam Username', value: 'steam' },
          { name: 'Discord Username', value: 'discord_username' },
          { name: 'Discord ID', value: 'discord_id' }
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Compare up to 3 CS2 skins side by side')
    .addStringOption(option =>
      option.setName('item1')
        .setDescription('First item name (required)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('item2')
        .setDescription('Second item name (required)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('item3')
        .setDescription('Third item name (optional)')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('pro')
    .setDescription('Check your Pro subscription status')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View and purchase Pro subscriptions and consumables')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('website')
    .setDescription('Get a link to the SkinVaults website')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('currency')
    .setDescription('Set your preferred currency for SkinVaults bot (EUR or USD)')
    .addStringOption(option =>
      option.setName('currency')
        .setDescription('Choose your currency')
        .setRequired(true)
        .addChoices(
          { name: 'EUR (€)', value: '3' },
          { name: 'USD ($)', value: '1' }
        )
    )
    .toJSON(),
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    log('Started refreshing application (/) commands.');
    log(`Registering ${commands.length} commands: ${commands.map(c => c.name).join(', ')}`);

    // Prevent duplicate command lists: if we previously registered guild commands,
    // they will show alongside global commands. Clear guild commands first.
    if (GUILD_ID) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID),
          { body: [] }
        );
        log(`🧹 Cleared guild commands for guild ${GUILD_ID}`);
      } catch (e) {
        log(`⚠️ Failed to clear guild commands: ${e.message}`);
      }
    }

    // Register commands globally (works for both server and user installs)
    // Global commands can take up to 1 hour to propagate, but work everywhere
    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    );

    log('✅ Successfully registered application commands globally.');
    log(`📋 Commands registered: ${commands.map(c => `/${c.name}`).join(', ')}`);
    log('⏳ Global commands may take up to 1 hour to appear in Discord.');
    log('💡 Tip: Commands will appear in DMs and servers where the bot is present.');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    if (error.code === 50001) {
      console.error('Missing Access: Make sure the bot has "applications.commands" scope');
    } else if (error.code === 50035) {
      console.error('Invalid Form Body: Check command definitions');
    } else if (error.code === 30034) {
      console.error('Maximum number of global commands reached (100). Consider using guild commands.');
    }
  }
}

// Fetch messages from gateway API
async function fetchQueuedMessages() {
  try {
    const headers = {};
    if (API_TOKEN) {
      headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }
    headers['Content-Type'] = 'application/json';

    log(`🔍 Fetching queued messages from ${API_BASE_URL}/api/discord/bot-gateway...`);
    log(`🔑 API Token present: ${API_TOKEN ? 'Yes' : 'No'}`);

    const response = await fetch(`${API_BASE_URL}/api/discord/bot-gateway`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ action: 'check_alerts' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ Failed to fetch queued messages: ${response.status} ${response.statusText}`);
      log(`❌ Error details: ${errorText}`);
      return [];
    }

    const data = await response.json();
    const queue = data.queue || [];
    if (queue.length > 0) {
      log(`📬 Found ${queue.length} message(s) in queue`);
      queue.forEach((msg, idx) => {
        const did = String(msg?.discordId || '').trim();
        const ts = typeof msg?.timestamp === 'number' ? msg.timestamp : NaN;
        const tsLabel = Number.isFinite(ts) ? new Date(ts).toISOString() : 'unknown';
        log(`   Message ${idx + 1}: Discord ID ${did || 'unknown'}, timestamp: ${tsLabel}`);
      });
    } else {
      log(`📭 No messages in queue`);
    }
    return queue;
  } catch (error) {
    log(`❌ Error fetching queued messages: ${error.message}`);
    console.error(error);
    return [];
  }
}

// Send DM to user
async function sendDM(discordId, message) {
  try {
    // Check if client is ready
    if (!client.isReady()) {
      log('❌ Bot is not ready yet, cannot send DM');
      return false;
    }

    log(`🔍 Fetching Discord user ${discordId}...`);
    const user = await client.users.fetch(discordId);
    if (!user) {
      log(`❌ User ${discordId} not found`);
      return false;
    }

    log(`👤 Found user: ${user.username} (${user.id})`);

    // Try to send DM
    try {
      log(`📤 Attempting to send DM to ${user.username} (${discordId})...`);
      await user.send(message);
      log(`✅ Successfully sent DM to ${user.username} (${discordId})`);
      return true;
    } catch (dmError) {
      // Common errors:
      // - 50007: Cannot send messages to this user (DMs disabled or bot blocked)
      // - 50013: Missing permissions
      if (dmError.code === 50007) {
        log(`⚠️ Cannot send DM to ${user.username} (${discordId}): User has DMs disabled or bot is blocked`);
      } else if (dmError.code === 50013) {
        log(`⚠️ Missing permissions to send DM to ${user.username} (${discordId})`);
      } else {
        log(`❌ Failed to send DM to ${user.username} (${discordId}): ${dmError.message}`);
      }
      return false;
    }
  } catch (error) {
    log(`❌ Error fetching user ${discordId} or sending DM: ${error.message}`);
    return false;
  }
}

// Process queued messages
async function processQueuedMessages() {
  // Only process if bot is ready
  if (!client.isReady()) {
    log('⏸️ Bot not ready yet, skipping queue check');
    return;
  }

  try {
    log('🔄 Checking for queued messages...');
    const messages = await fetchQueuedMessages();

    if (messages.length === 0) {
      return; // No messages to process
    }

    log(`📬 Processing ${messages.length} queued message(s)...`);

    let successCount = 0;
    let failCount = 0;

    for (const msg of messages) {
      const discordId = String(msg?.discordId || '').trim();
      const messageText = typeof msg?.message === 'string' ? msg.message : '';
      if (!/^\d{17,20}$/.test(discordId) || !messageText.trim()) {
        failCount++;
        log(`⚠️ Skipping invalid queued message (missing discordId/message)`);
        continue;
      }

      log(`📤 Processing message for Discord ID: ${discordId}`);
      const sent = await sendDM(discordId, messageText);
      if (sent) {
        successCount++;
      } else {
        failCount++;
      }
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (successCount > 0 || failCount > 0) {
      log(`✅ Processed ${messages.length} message(s): ${successCount} sent, ${failCount} failed`);
    }
  } catch (error) {
    log(`❌ Error processing queued messages: ${error.message}`);
    console.error(error);
  }
}

// Get user's Steam ID from Discord ID
async function getSteamIdFromDiscord(discordId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/discord/get-steam-id?discordId=${discordId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.steamId;
  } catch (error) {
    console.error('Error getting Steam ID:', error);
    return null;
  }
}

// Check if user has Pro status
async function checkProStatus(steamId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/pro?id=${steamId}`);
    if (!response.ok) return false;
    const data = await response.json();
    if (data?.proUntil) {
      return new Date(data.proUntil) > new Date();
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function getCurrencyPreference(discordId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/discord/preferences?discordId=${encodeURIComponent(discordId)}`);
    if (!response.ok) return '3';
    const data = await response.json();
    return data?.currency === '1' ? '1' : '3';
  } catch {
    return '3';
  }
}

async function setCurrencyPreference(discordId, currency) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/discord/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, currency }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Get Discord user ID from username (searches database first, then Discord servers)
async function getDiscordUserIdFromUsername(username, client) {
  try {
    // First, try to find in our database (most reliable)
    try {
      const response = await fetch(`${API_BASE_URL}/api/discord/find-by-username?username=${encodeURIComponent(username)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.discordId) {
          return data.discordId;
        }
      }
    } catch (error) {
      // Fall back to Discord server search
    }

    // Fallback: Search through Discord servers (only works if user is in same server as bot)
    if (client) {
      const cleanUsername = username.split('#')[0].toLowerCase();

      for (const guild of client.guilds.cache.values()) {
        try {
          const member = guild.members.cache.find(m =>
            m.user.username.toLowerCase() === cleanUsername ||
            m.user.displayName.toLowerCase() === cleanUsername ||
            m.user.globalName?.toLowerCase() === cleanUsername
          );

          if (member) {
            return member.user.id;
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding Discord user:', error);
    return null;
  }
}

async function getPlayerInventory(player) {
  // Fetch player's inventory from API
  const response = await fetch(`${API_BASE_URL}/api/steam/inventory?steamId=${player.id}&isPro=false`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.assets || [];
}

// Retrieve Steam profile info
async function getSteamProfile(steamId) {
  try {
    const response = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
    if (!response.ok) return null;
    const text = await response.text();
    const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || "User";
    const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || "";
    return { steamId, name, avatar };
  } catch {
    return null;
  }
}

// Resolve Steam username to Steam64 ID using steamid.io
async function resolveSteamUsername(username) {
  try {
    // Clean username: extract first part before | or special chars
    // "ExampleUser | Website.com" -> "ExampleUser"
    let cleanUsername = username.trim();

    // If it contains |, take the part before it
    if (cleanUsername.includes('|')) {
      cleanUsername = cleanUsername.split('|')[0].trim();
    }

    // Remove special chars that aren't allowed in Steam URLs (keep alphanumeric, underscore, hyphen)
    cleanUsername = cleanUsername.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!cleanUsername || cleanUsername.length < 3) return null;

    // Method 1: Try steamid.io lookup (most reliable)
    try {
      // steamid.io allows lookup via URL: https://steamid.io/lookup/{username}
      const steamIdIoUrl = `https://steamid.io/lookup/${encodeURIComponent(cleanUsername)}`;
      const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamIdIoUrl)}`, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      if (response.ok) {
        const html = await response.text();
        // Extract Steam64 ID from steamid.io page
        // Look for patterns like: steamID64</label>...76561199235618867 or "76561199235618867"
        const steamId64Matches = [
          html.match(/steamID64[^>]*>[\s\S]{0,200}?(\d{17})/i),
          html.match(/7656\d{13}/),
          html.match(/steamID64.*?copy[^>]*>[\s\S]{0,300}?(\d{17})/i),
        ].filter(Boolean);

        for (const match of steamId64Matches) {
          const steamId64 = match[1] || match[0];
          if (steamId64 && /^7656\d{13}$/.test(steamId64)) {
            return steamId64;
          }
        }
      }
    } catch (error) {
      console.error('steamid.io lookup failed:', error);
      // Continue to fallback method
    }

    // Method 2: Try Steam Community XML (fallback)
    try {
      const profileUrl = `https://steamcommunity.com/id/${cleanUsername}/?xml=1`;
      const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(profileUrl)}`, {
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const text = await response.text();
        const steamId64 = text.match(/<steamID64><!\[CDATA\[(.*?)\]\]><\/steamID64>/)?.[1];
        if (steamId64 && /^\d{17}$/.test(steamId64)) {
          return steamId64;
        }
      }
    } catch (error) {
      // Ignore
    }

    // Method 3: Try alternative proxy
    try {
      const profileUrl = `https://steamcommunity.com/id/${cleanUsername}/?xml=1`;
      const altResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(profileUrl)}`, {
        signal: AbortSignal.timeout(10000)
      });
      if (altResponse.ok) {
        const text = await altResponse.text();
        const steamId64 = text.match(/<steamID64><!\[CDATA\[(.*?)\]\]><\/steamID64>/)?.[1];
        if (steamId64 && /^\d{17}$/.test(steamId64)) {
          return steamId64;
        }
      }
    } catch {
      // Ignore
    }

    return null;
  } catch (error) {
    console.error('Error resolving Steam username:', error);
    return null;
  }
}

// Get top weapons from inventory (returns immediately with what it has, max 3)
async function getTopWeapons(steamId, limit = 3) {
  try {
    const invResponse = await fetch(`${API_BASE_URL}/api/steam/inventory?steamId=${encodeURIComponent(steamId)}&currency=3&includeTopItems=1&refresh=1`);
    if (!invResponse.ok) return [];

    const invData = await invResponse.json();
    const topItems = Array.isArray(invData?.topItems) ? invData.topItems : [];
    if (topItems.length === 0) return [];

    const symbol = '€';
    return topItems.slice(0, limit).map((it) => {
      const v = Number(it?.value || 0);
      const price = Number(it?.price || 0);
      return {
        name: it.marketHashName,
        price: Number.isFinite(price) && price > 0 ? `${symbol}${price.toFixed(2).replace('.', ',')}` : null,
        priceValue: Number.isFinite(v) ? v : 0,
      };
    });
  } catch (error) {
    console.error('Error getting top weapons:', error);
    return [];
  }
}

// Get wishlist for user
async function getWishlist(steamId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wishlist?steamId=${steamId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.wishlist || [];
  } catch (error) {
    console.error('Error getting wishlist:', error);
    return null;
  }
}

// Get price for item
async function getItemPrice(marketHashName, currency = '3') {
  try {
    const response = await fetch(`${API_BASE_URL}/api/steam/price?market_hash_name=${encodeURIComponent(marketHashName)}&currency=${currency}`);
    if (!response.ok) return null;
    const data = await response.json();
    // Return price data in consistent format
    if (data.success && (data.lowest_price || data.median_price)) {
      return {
        lowest_price: data.lowest_price || data.median_price,
        lowest: data.lowest_price || data.median_price,
        median_price: data.median_price,
        median: data.median_price,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting price:', error);
    return null;
  }
}

// Normalize text for fuzzy matching (remove special chars, normalize spaces)
function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .replace(/[★☆★☆|()\[\]{}]/g, ' ') // Remove special characters
    .replace(/[^\w\s]/g, ' ') // Remove other special chars, keep alphanumeric and spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
}

// Fuzzy search for items
async function searchItem(query) {
  try {
    // Try to fetch from the item database
    const datasets = [
      'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json',
      'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json',
      'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json',
      'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/agents.json',
    ];

    // Normalize query: remove special chars, normalize spaces
    const normalizedQuery = normalizeForSearch(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

    if (queryWords.length === 0) {
      return null;
    }

    // Search through all datasets
    for (const datasetUrl of datasets) {
      try {
        const response = await fetch(datasetUrl, { cache: 'force-cache' });
        if (!response.ok) continue;

        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);

        // First try exact match (normalized)
        let found = items.find(item => {
          const name = normalizeForSearch(item.market_hash_name || item.name || '');
          return name === normalizedQuery;
        });

        if (found) {
          return {
            market_hash_name: found.market_hash_name || found.name,
            name: found.name || found.market_hash_name,
            image: found.image || found.icon_url,
            id: found.id,
          };
        }

        // Then try fuzzy match (all words must be in the normalized name)
        found = items.find(item => {
          const name = normalizeForSearch(item.market_hash_name || item.name || '');
          return queryWords.every(word => name.includes(word));
        });

        if (found) {
          return {
            market_hash_name: found.market_hash_name || found.name,
            name: found.name || found.market_hash_name,
            image: found.image || found.icon_url,
            id: found.id,
          };
        }

        // Then try partial match (most words match)
        found = items.find(item => {
          const name = normalizeForSearch(item.market_hash_name || item.name || '');
          const matchingWords = queryWords.filter(word => name.includes(word));
          return matchingWords.length >= Math.ceil(queryWords.length * 0.7); // At least 70% of words match
        });

        if (found) {
          return {
            market_hash_name: found.market_hash_name || found.name,
            name: found.name || found.market_hash_name,
            image: found.image || found.icon_url,
            id: found.id,
          };
        }
      } catch (error) {
        // Continue to next dataset
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching item:', error);
    return null;
  }
}

// Get alerts for user
async function getAlerts(steamId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/list?steamId=${steamId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.alerts || [];
  } catch (error) {
    console.error('Error getting alerts:', error);
    return null;
  }
}

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  // Log all interactions for debugging
  if (interaction.isChatInputCommand()) {
    log(`📥 Received command: /${interaction.commandName} from user ${interaction.user.id} (${interaction.user.username})`);
  } else if (interaction.isAutocomplete()) {
    log(`📥 Received autocomplete for: ${interaction.commandName}`);
    return;
  } else {
    // Log other interaction types
    log(`📥 Received interaction type: ${interaction.type}`);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  try {
    if (['ban', 'timeout', 'banadmin', 'timeoutadmin'].includes(commandName)) {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(interaction.user.id);
      const isBotOwner = OWNER_STEAM_IDS.includes(steamId);
      const isServerOwner = interaction.user.id === interaction.guild?.ownerId;

      if ((commandName === 'banadmin' || commandName === 'timeoutadmin') && !isBotOwner) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command. This is for bot owners only.' });
      }

      if ((commandName === 'ban' || commandName === 'timeout') && !isServerOwner && !isBotOwner) {
        return interaction.editReply({ content: '❌ This command can only be used by the server owner.' });
      }

      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      const duration = interaction.options.getInteger('duration'); // For timeouts

      if (!targetUser) {
        return interaction.editReply({ content: '❌ You must specify a user to moderate.' });
      }

      if (targetUser.id === client.user.id) {
        return interaction.editReply({ content: '❌ You cannot moderate the bot itself.' });
      }

      try {
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        // Apply Discord-side moderation
        if (commandName.startsWith('ban')) {
          await interaction.guild.members.ban(targetUser, { reason: `Action by ${interaction.user.tag}. Reason: ${reason}`, deleteMessageSeconds: 604800 }); // 7 days of messages
        } else if (member && commandName.startsWith('timeout')) {
          await member.timeout(duration * 60 * 1000, `Action by ${interaction.user.tag}. Reason: ${reason}`);
        } else if (!member && commandName.startsWith('timeout')) {
            // Cannot timeout a user who is not in the server
        }

        // Apply Website-side moderation
        const targetSteamId = await getSteamIdFromDiscord(targetUser.id);
        let websiteMessage = 'Discord action successful.';
        if (targetSteamId) {
          const apiResponse = await fetch(`${API_BASE_URL}/api/discord/bot/moderation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_TOKEN}`
            },
            body: JSON.stringify({
              action: commandName.includes('timeout') ? 'timeout' : 'ban',
              steamId: targetSteamId,
              reason: `[By Discord User: ${interaction.user.tag}] ${reason}`,
              duration: duration,
              actingAdminSteamId: steamId
            })
          });

          if (apiResponse.ok) {
            const result = await apiResponse.json();
            websiteMessage = result.message || 'Website moderation successful.';
          } else {
            const errorData = await apiResponse.json();
            websiteMessage = `Website moderation failed: ${errorData.error}`;
          }
        }

        await interaction.editReply({ content: `✅ Successfully applied moderation on ${targetUser.tag}.\n🌐 ${websiteMessage}` });

      } catch (error) {
        console.error(`Failed to execute ${commandName}:`, error);
        await interaction.editReply({ content: `❌ Failed to moderate user: ${error.message}` });
      }

    } else if (commandName === 'support') {
      const supportGuildId = process.env.DISCORD_GUILD_ID;
      const supportChannelId = process.env.SUPPORT_INVITE_CHANNEL_ID;

      if (!supportGuildId || !supportChannelId) {
        return interaction.reply({ content: 'The support server has not been configured by the bot owner.', ephemeral: true });
      }

      try {
        const guild = await client.guilds.fetch(supportGuildId);
        const channel = await guild.channels.fetch(supportChannelId);

        if (channel.type !== 0 && channel.type !== 2) { // Text or Voice
          return interaction.reply({ content: 'The configured support channel is not a valid text or voice channel.', ephemeral: true });
        }

        const invite = await channel.createInvite({
          maxAge: 3600, // 1 hour
          maxUses: 1,
          unique: true,
          reason: `Support invite for ${interaction.user.tag}`
        });

        await interaction.reply({ content: `Here is a one-time invite to the support server: ${invite.url}`, ephemeral: true });

      } catch (error) {
        console.error('Error creating support invite:', error);
        await interaction.reply({ content: 'Could not create an invite. The bot may not have the correct permissions.', ephemeral: true });
      }

    } else if (commandName === 'credits') {
      await interaction.deferReply({ ephemeral: true });
      const steamId = await getSteamIdFromDiscord(user.id);
      if (!steamId) {
        return interaction.editReply({ content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first on the website.' });
      }

      if (!API_TOKEN) {
        return interaction.editReply({ content: '❌ Bot API token is not configured. Contact the bot owner.' });
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/credits/balance?steamId=${encodeURIComponent(steamId)}`,
          {
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
            }
          }
        );
        if (!response.ok) throw new Error('Failed to fetch balance.');
        const data = await response.json();
        const embed = new EmbedBuilder()
          .setTitle('💰 Your Credits Balance')
          .setDescription(`You have **${data.balance.toLocaleString()}** credits.`)
          .setColor(0x5865F2)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Could not retrieve your credits balance.' });
      }

    } else if (commandName === 'daily') {
      await interaction.deferReply({ ephemeral: true });
      const steamId = await getSteamIdFromDiscord(user.id);
      if (!steamId) {
        return interaction.editReply({ content: '❌ **Not Connected**\n\nYou need to connect your Discord account first on the website.' });
      }

      if (!API_TOKEN) {
        return interaction.editReply({ content: '❌ Bot API token is not configured. Contact the bot owner.' });
      }
      try {
        const postResponse = await fetch(`${API_BASE_URL}/api/credits/daily-claim?steamId=${encodeURIComponent(steamId)}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
            }
          }
        );
        const data = await postResponse.json();
        if (postResponse.ok) {
          await interaction.editReply({ content: `🎉 You successfully claimed **${data.claimed}** credits! Your new balance is **${data.balance.toLocaleString()}** credits.` });
        } else {
          if (data.error === 'Already claimed today') {
            const getResponse = await fetch(`${API_BASE_URL}/api/credits/daily-claim?steamId=${encodeURIComponent(steamId)}`,
              {
                headers: {
                  'Authorization': `Bearer ${API_TOKEN}`,
                }
              }
            );
            const statusData = await getResponse.json();
            const nextEligibleDate = new Date(statusData.nextEligibleAt);
            await interaction.editReply({ content: `⌛ You have already claimed your daily reward. You can claim again <t:${Math.floor(nextEligibleDate.getTime() / 1000)}:R>.` });
          } else {
            await interaction.editReply({ content: `❌ Failed to claim daily reward: ${data.error}` });
          }
        }
      } catch (error) {
        await interaction.editReply({ content: '❌ An error occurred while trying to claim your daily reward.' });
      }

    } else if (commandName === 'spins') {
      await interaction.deferReply({ ephemeral: true });
      const steamId = await getSteamIdFromDiscord(user.id);
      if (!steamId) {
        return interaction.editReply({ content: '❌ **Not Connected**\n\nYou need to connect your Discord account first on the website.' });
      }

      if (!API_TOKEN) {
        return interaction.editReply({ content: '❌ Bot API token is not configured. Contact the bot owner.' });
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/spins?steamId=${encodeURIComponent(steamId)}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
            }
          }
        );
        const data = await response.json();

        if (response.ok) {
          await interaction.editReply({ content: `🎉 You spun the wheel and won **${data.reward}** credits! Your new balance is **${data.newBalance.toLocaleString()}** credits.` });
        } else {
          if (data.error === 'Already spun today') {
            const statusRes = await fetch(`${API_BASE_URL}/api/spins?steamId=${encodeURIComponent(steamId)}`,
              {
                headers: {
                  'Authorization': `Bearer ${API_TOKEN}`,
                }
              }
            );
            const statusData = await statusRes.json();
            const nextEligibleDate = new Date(statusData.nextEligibleAt);
            await interaction.editReply({ content: `⌛ You have already used your spin for today. You can spin again <t:${Math.floor(nextEligibleDate.getTime() / 1000)}:R>.` });
          } else {
            await interaction.editReply({ content: `❌ Failed to use your spin: ${data.error}` });
          }
        }
      } catch (error) {
        await interaction.editReply({ content: '❌ An error occurred while trying to use your spin.' });
      }

    } else if (commandName === 'giveaways') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const response = await fetch(`${API_BASE_URL}/api/giveaways?status=active`);
        if (!response.ok) throw new Error('Failed to fetch giveaways.');
        const { giveaways } = await response.json();
        if (!giveaways || giveaways.length === 0) {
          return interaction.editReply({ content: 'There are no active giveaways right now. Check back later!' });
        }
        const embed = new EmbedBuilder()
          .setTitle('🎉 Active Giveaways')
          .setColor(0x5865F2)
          .setTimestamp();
        for (const giveaway of giveaways.slice(0, 5)) {
          embed.addFields({
            name: `${giveaway.title}`,
            value: `🎁 **Prize:** ${giveaway.prize}\n💰 **Entry Cost:** ${giveaway.creditsPerEntry} credits\n👥 **Entries:** ${giveaway.totalEntries}\n🔚 **Ends:** <t:${Math.floor(new Date(giveaway.endAt).getTime() / 1000)}:R>\n🔗 **[Enter Here](https://skinvaults.online/giveaways/${giveaway.id})**`,
            inline: false
          });
        }
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply({ content: '❌ Could not retrieve active giveaways.' });
      }

    } else if (commandName === 'wishlist') {
      await interaction.deferReply({ ephemeral: true });

      const currency = await getCurrencyPreference(user.id);

      const steamId = await getSteamIdFromDiscord(user.id);

      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first.\n\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can use this command!',
        });
        return;
      }

      const wishlist = await getWishlist(steamId);

      if (!wishlist || wishlist.length === 0) {
        await interaction.editReply({
          content: '📝 **Your Wishlist is Empty**\n\nAdd items to your wishlist on SkinVaults to track their prices!\n\nVisit: https://skinvaults.online',
        });
        return;
      }

      // Get prices for all items (limit to first 10 for embed)
      const itemsToShow = wishlist.slice(0, 10);
      const pricePromises = itemsToShow.map(item =>
        getItemPrice(item.market_hash_name || item.key, currency)
      );
      const prices = await Promise.all(pricePromises);

      // Create embed with thumbnail from first item
      const firstItem = itemsToShow[0];
      const embed = new EmbedBuilder()
        .setTitle('📋 Your Wishlist')
        .setDescription(`Showing ${itemsToShow.length} of ${wishlist.length} items`)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

      // Add thumbnail if first item has image
      if (firstItem?.image) {
        embed.setThumbnail(firstItem.image);
      }

      const fields = itemsToShow.map((item, index) => {
        const price = prices[index];
        const priceText = price?.lowest_price || price?.lowest || price?.median_price || 'No price data';
        const itemUrl = `https://skinvaults.online/item/${encodeURIComponent(item.market_hash_name || item.key)}`;

        return {
          name: `${index + 1}. ${item.name || item.key}`,
          value: `💰 **Price:** ${priceText}\n🔗 [View Item](${itemUrl})`,
          inline: false,
        };
      });

      // Discord embeds have a limit of 25 fields, but we're only showing 10
      embed.addFields(fields);

      if (wishlist.length > 10) {
        embed.setDescription(`Showing first 10 of ${wishlist.length} items\n\nView all items: https://skinvaults.online/wishlist`);
      }

      await interaction.editReply({ embeds: [embed] });

    } else if (commandName === 'guild') {
      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&scope=${encodeURIComponent('bot applications.commands')}&permissions=0`;
      await interaction.reply({
        ephemeral: true,
        content:
          `🔗 **Invite SkinVaults Bot to your server**\n\n` +
          `${inviteUrl}\n\n` +
          `Scopes:\n` +
          `- bot\n` +
          `- applications.commands\n\n` +
          `If Discord says the redirect URI is invalid, make sure your app has this redirect URI configured:\n` +
          `https://www.skinvaults.online/api/discord/callback`,
      });

    } else if (commandName === 'alerts') {
      await interaction.deferReply({ ephemeral: true });

      const currencyPref = await getCurrencyPreference(user.id);

      const steamId = await getSteamIdFromDiscord(user.id);

      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first.\n\nVisit: https://skinvaults.online/inventory',
        });
        return;
      }

      const alerts = await getAlerts(steamId);

      if (!alerts || alerts.length === 0) {
        await interaction.editReply({
          content: '🔔 **No Active Alerts**\n\nSet up price alerts on SkinVaults to get notified when prices hit your target!\n\nVisit: https://skinvaults.online',
        });
        return;
      }

      // Get current prices for alerts
      const pricePromises = alerts.slice(0, 10).map(alert =>
        getItemPrice(alert.marketHashName, currencyPref)
      );
      const prices = await Promise.all(pricePromises);

      const embed = new EmbedBuilder()
        .setTitle('🔔 Your Price Alerts')
        .setDescription(`You have ${alerts.length} active price alert${alerts.length > 1 ? 's' : ''}`)
        .setColor(0x5865F2)
        .setTimestamp();

      const fields = alerts.slice(0, 10).map((alert, index) => {
        const condition = alert.condition === 'below' ? '≤' : '≥';
        const currency = alert.currency === '1' ? 'USD' : 'EUR';
        const symbol = alert.currency === '1' ? '$' : '€';
        const status = alert.triggered ? '✅ Triggered' : '⏳ Active';
        const price = prices[index];
        const currentPrice = price?.lowest_price || price?.lowest || price?.median_price || 'No price data';
        const itemUrl = `https://skinvaults.online/item/${encodeURIComponent(alert.marketHashName)}`;

        return {
          name: `${index + 1}. ${alert.marketHashName}`,
          value: `💰 **Current:** ${currentPrice}\n🎯 **Target:** ${condition} ${symbol}${alert.targetPrice.toFixed(2)}\n**Status:** ${status}\n🔗 [View Item](${itemUrl})`,
          inline: false,
        };
      });

      embed.addFields(fields);

      // Add thumbnail from first alert item if available
      if (alerts.length > 0) {
        // Try to get item image from API
        try {
          const firstAlert = alerts[0];
          const itemResponse = await fetch(`${API_BASE_URL}/api/item/info?market_hash_name=${encodeURIComponent(firstAlert.marketHashName)}`);
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            if (itemData.image) {
              embed.setThumbnail(itemData.image);
            }
          }
        } catch (error) {
          // Ignore errors getting image
        }
      }

      if (alerts.length > 10) {
        embed.setDescription(`Showing first 10 of ${alerts.length} alerts\n\nManage alerts: https://skinvaults.online/inventory`);
      }

      await interaction.editReply({ embeds: [embed] });

    } else if (commandName === 'price') {
      await interaction.deferReply({ ephemeral: true });

      const currency = await getCurrencyPreference(user.id);

      const itemQuery = interaction.options.getString('item');
      if (!itemQuery) {
        await interaction.editReply({
          content: '❌ **Missing Item Name**\n\nPlease provide an item name. Example: `/price AK-47 | Redline (Field-Tested)` or `/price snakebite`',
        });
        return;
      }

      // First try fuzzy search to find the item
      const searchResult = await searchItem(itemQuery);
      const itemName = searchResult?.market_hash_name || itemQuery;
      const displayName = searchResult?.name || itemQuery;
      let itemImage = searchResult?.image || null;
      const itemId = searchResult?.id || null;

      // Get price for the found item
      const price = await getItemPrice(itemName, currency);

      // If no price found, try to get item info from API
      if (!price) {
        let itemInfo = null;
        try {
          const itemResponse = await fetch(`${API_BASE_URL}/api/item/info?market_hash_name=${encodeURIComponent(itemName)}`);
          if (itemResponse.ok) {
            itemInfo = await itemResponse.json();
            if (itemInfo.image && !itemImage) {
              itemImage = itemInfo.image;
            }
          }
        } catch (error) {
          // Ignore
        }

        if (!itemInfo && !searchResult) {
          await interaction.editReply({
            content: `❌ **Item Not Found**\n\nCould not find price data for: "${itemQuery}"\n\n💡 **Tip:** Try a partial name like "snakebite" or "ak redline"\n\nSearch for items on: https://skinvaults.online`,
          });
          return;
        }
      }

      const priceText = price ? (price.lowest_price || price.lowest || price.median_price || 'No price data') : 'No price data';
      const itemUrl = itemId
        ? `https://skinvaults.online/item/${encodeURIComponent(itemId)}`
        : `https://skinvaults.online/item/${encodeURIComponent(itemName)}`;

      const embed = new EmbedBuilder()
        .setTitle(`💰 ${displayName}`)
        .setDescription(`**Current Price:** ${priceText}`)
        .setColor(0x5865F2)
        .setURL(itemUrl)
        .setTimestamp()
        .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

      // Set image if available
      if (itemImage) {
        embed.setThumbnail(itemImage);
      } else {
        // Try to get image from item info API
        try {
          const itemResponse = await fetch(`${API_BASE_URL}/api/item/info?market_hash_name=${encodeURIComponent(itemName)}`);
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            if (itemData.image) {
              embed.setThumbnail(itemData.image);
            }
          }
        } catch (error) {
          // Ignore errors getting image
        }
      }

      // If fuzzy search found a different item, mention it
      if (searchResult && searchResult.market_hash_name !== itemQuery) {
        embed.setDescription(`**Current Price:** ${priceText}\n\n*Found: "${displayName}"*`);
      }

      await interaction.editReply({ embeds: [embed] });

    } else if (commandName === 'inventory') {
      await interaction.deferReply({ ephemeral: true });

      const currency = await getCurrencyPreference(user.id);

      const steamId = await getSteamIdFromDiscord(user.id);

      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first.\n\n**Steps to connect:**\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can use this command!',
        });
        return;
      }

      try {
        const invResponse = await fetch(`${API_BASE_URL}/api/steam/inventory?steamId=${encodeURIComponent(steamId)}&currency=${currency}&isPro=false`);
        if (!invResponse.ok) {
          const errorText = await invResponse.text().catch(() => 'Unknown error');
          let errorMessage = 'Could not fetch your inventory.';

          if (invResponse.status === 403 || invResponse.status === 401) {
            errorMessage = 'Your Steam inventory is private. Set your Steam profile to public to view your inventory.';
          } else if (invResponse.status === 404) {
            errorMessage = 'Inventory not found. Make sure you have CS2 items in your Steam inventory.';
          } else if (invResponse.status === 429) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          }

          await interaction.editReply({
            content: `❌ **Failed to Load Inventory**\n\n${errorMessage}\n\n💡 **Try:**\n• Set your Steam profile to public\n• Visit https://skinvaults.online/inventory to sync\n• Wait a moment and try again`,
          });
          return;
        }

        const invData = await invResponse.json();

        const isPrivate =
          invData?.success === false ||
          String(invData?.error || '').toLowerCase().includes('private');

        if (isPrivate) {
          const vaultUrl = `https://skinvaults.online/inventory/${steamId}`;
          await interaction.editReply({
            content: `🔒 **Inventory Private**\n\nYour Steam inventory is private, so SkinVaults can't read your items.\n\n💡 **Fix:**\n• Set your Steam profile and inventory to public\n• Then open [your vault](${vaultUrl}) once to sync`,
          });
          return;
        }

        const assets = Array.isArray(invData?.assets) ? invData.assets : [];
        const descriptions = Array.isArray(invData?.descriptions) ? invData.descriptions : [];
        const rgInventory = invData?.rgInventory && typeof invData.rgInventory === 'object' ? invData.rgInventory : null;
        const rgDescriptions = invData?.rgDescriptions && typeof invData.rgDescriptions === 'object' ? invData.rgDescriptions : null;

        const rgInventoryAssets = rgInventory ? Object.values(rgInventory) : [];
        const rgDescList = rgDescriptions ? Object.values(rgDescriptions) : [];

        const hasAnyAssets = assets.length > 0 || rgInventoryAssets.length > 0;
        const hasAnyDescriptions = descriptions.length > 0 || rgDescList.length > 0;

        if (!hasAnyAssets || !hasAnyDescriptions) {
          const vaultUrl = `https://skinvaults.online/inventory/${steamId}`;
          await interaction.editReply({
            content: `📦 **No Items Found**\n\nYour inventory appears to be empty or not synced yet.\n\n💡 **Try:**\n• Visit [your vault](${vaultUrl}) to sync your inventory\n• Make sure your Steam profile is public\n• Try again in a few moments`,
          });
          return;
        }

        // Create a map of description by classid_instanceid
        const descMap = new Map();
        descriptions.forEach(desc => {
          const key = `${desc.classid}_${desc.instanceid || 0}`;
          descMap.set(key, desc);
        });
        rgDescList.forEach((desc) => {
          const d = desc;
          if (!d || !d.classid) return;
          const key = `${d.classid}_${d.instanceid || 0}`;
          if (!descMap.has(key)) descMap.set(key, d);
        });

        // Process assets
        const itemCounts = new Map();

        const allAssets = assets.length ? assets : rgInventoryAssets;
        for (const asset of allAssets) {
          const key = `${asset.classid}_${asset.instanceid || 0}`;
          const desc = descMap.get(key);
          if (!desc) continue;

          const itemName = desc.market_hash_name || desc.market_name || desc.name || `Item ${desc.classid}`;
          const amount = Number(asset.amount || 1) || 1;

          const currentCount = itemCounts.get(itemName) || 0;
          itemCounts.set(itemName, currentCount + amount);
        }

        // Convert to array and sort
        const sortedItems = Array.from(itemCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const totalItems = allAssets.reduce((sum, a) => sum + (Number(a?.amount || 1) || 1), 0);
        const uniqueItems = sortedItems.length;
        const vaultUrl = `https://skinvaults.online/inventory/${steamId}`;

        const embed = new EmbedBuilder()
          .setTitle('📦 Your Inventory')
          .setColor(0x5865F2)
          .setURL(vaultUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

        embed.addFields(
          { name: '📊 Summary', value: `**Total Items:** ${totalItems}\n**Unique Items:** ${uniqueItems}`, inline: false }
        );

        const itemsToShow = sortedItems.slice(0, 20);
        if (itemsToShow.length > 0) {
          const itemsList = itemsToShow
            .map((item, index) => {
              const countText = item.count > 1 ? ` (x${item.count})` : '';
              return `${index + 1}. ${item.name}${countText}`;
            })
            .join('\n');

          embed.addFields({
            name: `📋 Items (${itemsToShow.length}${sortedItems.length > 20 ? ` of ${sortedItems.length}` : ''})`,
            value: itemsList.length > 1024 ? itemsList.substring(0, 1020) + '...' : itemsList,
            inline: false,
          });

          if (sortedItems.length > 20) {
            embed.setDescription(`Showing first 20 of ${sortedItems.length} unique items\n\n[View Full Inventory](${vaultUrl})`);
          } else {
            embed.setDescription(`[View Full Inventory with Prices](${vaultUrl})`);
          }
        } else {
          embed.setDescription(`No items found.\n\n[View Inventory](${vaultUrl})`);
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error getting inventory:', error);
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to load inventory. Please try again later.',
        });
      }
    } else if (commandName === 'vault') {
      await interaction.deferReply({ ephemeral: true });

      const currency = await getCurrencyPreference(user.id);

      const steamId = await getSteamIdFromDiscord(user.id);

      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first.\n\n**Steps to connect:**\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can use this command!',
        });
        return;
      }

      try {
        const isPro = await checkProStatus(steamId);
        const invResponse = await fetch(
          `${API_BASE_URL}/api/steam/inventory?steamId=${encodeURIComponent(steamId)}&currency=${currency}&isPro=${isPro ? 'true' : 'false'}&refresh=1&includeTopItems=1`,
          { cache: 'no-store' }
        );

        if (!invResponse.ok) {
          let errorMessage = 'Could not fetch your inventory.';
          if (invResponse.status === 403 || invResponse.status === 401) {
            errorMessage = 'Your Steam inventory is private. Set your Steam profile to public to view your inventory.';
          } else if (invResponse.status === 404) {
            errorMessage = 'Inventory not found. Make sure you have CS2 items in your Steam inventory.';
          } else if (invResponse.status === 429) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          }

          await interaction.editReply({
            content: `❌ **Failed to Load Inventory**\n\n${errorMessage}\n\n💡 **Try:**\n• Set your Steam profile to public\n• Visit https://skinvaults.online/inventory to sync\n• Wait a moment and try again`,
          });
          return;
        }

        const invData = await invResponse.json();

        if (invData?.success === false && String(invData?.error || '').toLowerCase().includes('private')) {
          const vaultUrl = `https://skinvaults.online/inventory/${steamId}?currency=${encodeURIComponent(currency)}`;
          await interaction.editReply({
            content: `🔒 **Inventory Private**\n\nYour Steam inventory is private, so SkinVaults can't read your items.\n\n💡 **Fix:**\n• Set your Steam profile and inventory to public\n• Then open [your vault](${vaultUrl}) once to sync`,
          });
          return;
        }

        const assets = Array.isArray(invData?.assets) ? invData.assets : [];
        const descriptions = Array.isArray(invData?.descriptions) ? invData.descriptions : [];
        const totalItems = assets.reduce((sum, a) => sum + Number(a?.amount || 1), 0);
        const uniqueItems = new Set(descriptions.map(d => String(d?.market_hash_name || d?.market_name || d?.name || '').trim()).filter(Boolean)).size;

        const vaultUrl = `https://skinvaults.online/inventory/${steamId}?currency=${encodeURIComponent(currency)}`;
        const totalInventoryValue = typeof invData?.totalInventoryValue === 'string' ? invData.totalInventoryValue : '0.00';
        const totalValueNum = Number.parseFloat(totalInventoryValue);
        const symbol = currency === '1' ? '$' : '€';
        const totalValueStr = Number.isFinite(totalValueNum) && totalValueNum > 0
          ? `${symbol}${totalValueNum.toFixed(2).replace('.', ',')}`
          : `${symbol}0,00`;

        const topItems = Array.isArray(invData?.topItems) ? invData.topItems : [];

        const embed = new EmbedBuilder()
          .setTitle(`💎 Your Vault${isPro ? ' ⚡ PRO' : ''}`)
          .setColor(0x5865F2)
          .setURL(vaultUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

        embed.addFields(
          { name: '📦 Total Items', value: String(totalItems || 0), inline: true },
          { name: '🔢 Unique Items', value: String(uniqueItems || 0), inline: true },
          { name: '💰 Total Value', value: totalValueStr, inline: true }
        );

        if (topItems.length > 0) {
          const lines = topItems.slice(0, 5).map((it, idx) => {
            const val = Number(it?.value || 0);
            const txt = Number.isFinite(val) && val > 0 ? `${symbol}${val.toFixed(2).replace('.', ',')}` : `${symbol}0,00`;
            return `${idx + 1}. ${it.marketHashName} - ${txt}`;
          }).join('\n');
          embed.addFields({ name: '🔝 Top Items', value: lines.length > 1024 ? lines.slice(0, 1020) + '...' : lines, inline: false });
        }

        if (!assets.length && !descriptions.length) {
          embed.setDescription(`📦 **No Items Found**\n\nYour inventory appears to be empty, private, or not synced yet.\n\n[Open your vault on the website](${vaultUrl})`);
        } else {
          embed.setDescription(`[View Full Vault](${vaultUrl})`);
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error getting vault:', error);
        await interaction.editReply({
          content: `❌ **Error Loading Vault**\n\nFailed to load vault data: ${error.message}\n\n💡 **Try:**\n• Make sure your Steam profile is public\n• Visit https://skinvaults.online/inventory to sync\n• Try again in a few moments`,
        });
      }
    } else if (commandName === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);

      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first.\n\n**Steps to connect:**\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n4. Authorize the connection\n\nOnce connected, you can use this command!',
        });
        return;
      }

      try {
        // Check Pro status for your own stats
        const isPro = await checkProStatus(steamId);

        // API expects 'id' parameter, not 'steamId'
        const statsResponse = await fetch(`${API_BASE_URL}/api/steam/stats?id=${steamId}`);
        if (!statsResponse.ok) {
          await interaction.editReply({
            content: '❌ **Stats Private**\n\nYour CS2 stats are private. Set your Steam profile to public to view stats.',
          });
          return;
        }

        const statsData = await statsResponse.json();
        // The API returns { playerstats: { stats: [...] } } where stats is an array
        const ps = statsData?.playerstats;
        const s = ps?.stats;

        if (!s || !Array.isArray(s)) {
          await interaction.editReply({
            content: '❌ **Stats Private**\n\nYour CS2 stats are private. Set your Steam profile to public to view stats.',
          });
          return;
        }

        // Convert array format to object format (like the website does)
        const statsObj = {};
        s.forEach((item) => {
          if (item.name && item.value !== undefined) {
            statsObj[item.name] = item.value;
          }
        });

        const kills = Number(statsObj.total_kills ?? 0);
        const deaths = Number(statsObj.total_deaths ?? 0);
        const hsKills = Number(statsObj.total_kills_headshot ?? 0);
        const matchesWon = Number(statsObj.total_matches_won ?? 0);
        const totalDamage = Number(statsObj.total_damage_done ?? 0);
        const roundsPlayed = Number(statsObj.total_rounds_played ?? 0);
        const mvps = Number(statsObj.total_mvps ?? 0);
        const totalShots = Number(statsObj.total_shots_hit ?? 0) + Number(statsObj.total_shots_fired ?? 0);
        const shotsHit = Number(statsObj.total_shots_hit ?? 0);

        const kd = deaths > 0 ? (kills / deaths) : kills > 0 ? kills : 0;
        const hs = kills > 0 ? (hsKills / kills) * 100 : 0;
        const adr = roundsPlayed > 0 ? (totalDamage / roundsPlayed) : 0;
        const accuracy = totalShots > 0 ? (shotsHit / totalShots) * 100 : 0;

        const embed = new EmbedBuilder()
          .setTitle(`📊 Your CS2 Stats${isPro ? ' ⚡ PRO' : ''}`)
          .setColor(0x5865F2)
          .setURL(`https://skinvaults.online/inventory/${steamId}`)
          .setTimestamp()
          .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

        // Basic stats (always shown)
        if (kills > 0) {
          embed.addFields({ name: '💀 Total Kills', value: kills.toLocaleString(), inline: true });
        }
        if (deaths > 0) {
          embed.addFields({ name: '☠️ Total Deaths', value: deaths.toLocaleString(), inline: true });
        }
        if (kills > 0 || deaths > 0) {
          embed.addFields({ name: '📈 K/D Ratio', value: kd.toFixed(2), inline: true });
        }
        if (matchesWon > 0) {
          embed.addFields({ name: '🏆 Wins', value: matchesWon.toLocaleString(), inline: true });
        }
        if (hs > 0) {
          embed.addFields({ name: '🎯 HS %', value: `${hs.toFixed(1)}%`, inline: true });
        }

        // Advanced stats (Pro-only, like on website)
        if (isPro) {
          if (adr > 0) {
            embed.addFields({ name: '💜 ADR', value: adr.toFixed(1), inline: true });
          }
          if (mvps > 0) {
            embed.addFields({ name: '⭐ MVPs', value: mvps.toLocaleString(), inline: true });
          }
          if (accuracy > 0) {
            embed.addFields({ name: '🎯 Accuracy', value: `${accuracy.toFixed(1)}%`, inline: true });
          }
          if (roundsPlayed > 0) {
            embed.addFields({ name: '🔄 Rounds Played', value: roundsPlayed.toLocaleString(), inline: true });
          }
          if (totalDamage > 0) {
            embed.addFields({ name: '💥 Total Damage', value: totalDamage.toLocaleString(), inline: true });
          }
        } else {
          embed.addFields({
            name: '🔒 Advanced Stats',
            value: 'Upgrade to **PRO** to see ADR, MVPs, Accuracy, Rounds Played, and Total Damage!\n\n[Get PRO](https://skinvaults.online/pro)',
            inline: false
          });
        }

        if (embed.data.fields?.length === 0) {
          embed.setDescription('No stats available. Make sure your Steam profile is public.');
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error getting stats:', error);
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to load stats. Please try again later.',
        });
      }

    } else if (commandName === 'player') {
      await interaction.deferReply({ ephemeral: true });

      const query = interaction.options.getString('query');
      const platform = interaction.options.getString('platform');

      if (!query) {
        await interaction.editReply({
          content: '❌ **Missing Query**\n\nPlease provide a Steam64 ID, Discord username, or Steam username.',
        });
        return;
      }

      try {
        let steamId = null;
        let profile = null;
        let searchMethod = '';

        // If platform is specified, search only that platform
        if (platform === 'steam64') {
          if (!/^\d{17}$/.test(query)) {
            await interaction.editReply({
              content: '❌ **Invalid Steam64 ID**\n\nSteam64 ID must be exactly 17 digits. Example: `76561199052427203`',
            });
            return;
          }
          steamId = query;
          profile = await getSteamProfile(steamId);
          searchMethod = 'Steam64 ID';
        } else if (platform === 'steam') {
          steamId = await resolveSteamUsername(query);
          if (steamId) {
            profile = await getSteamProfile(steamId);
            searchMethod = 'Steam username';
          } else {
            await interaction.editReply({
              content: `❌ **Steam Username Not Found**\n\nCould not find Steam profile for: "${query}"\n\n💡 **Tips:**\n• Use just the username part (e.g., "ExampleUser" instead of "ExampleUser | Website.com")\n• Make sure the Steam custom URL is correct\n• Try using Steam64 ID instead`,
            });
            return;
          }
        } else if (platform === 'discord_username') {
          // Try Discord username in database first
          try {
            const discordResponse = await fetch(`${API_BASE_URL}/api/discord/find-by-username?username=${encodeURIComponent(query)}`);
            if (discordResponse.ok) {
              const discordData = await discordResponse.json();
              if (discordData.discordId && discordData.steamId) {
                steamId = discordData.steamId;
                profile = await getSteamProfile(steamId);
                searchMethod = 'Discord username (database)';
              }
            }
          } catch (error) {
            // Continue to fallback
          }

          // Fallback: Try via Discord client
          if (!steamId) {
            const discordUserId = await getDiscordUserIdFromUsername(query, client);
            if (discordUserId) {
              steamId = await getSteamIdFromDiscord(discordUserId);
              if (steamId) {
                profile = await getSteamProfile(steamId);
                searchMethod = 'Discord username (server)';
              }
            }
          }

          if (!steamId || !profile) {
            await interaction.editReply({
              content: `❌ **Discord Username Not Found**\n\nCould not find Discord user: "${query}"\n\n💡 **Make sure:**\n• The user has connected their Discord account to SkinVaults\n• You're using the correct Discord username\n• The user is in a server with the bot (if not in database)\n\nOr try using their Steam64 ID instead.`,
            });
            return;
          }
        } else if (platform === 'discord_id') {
          if (!/^\d{17,19}$/.test(query)) {
            await interaction.editReply({
              content: '❌ **Invalid Discord ID**\n\nDiscord ID must be 17-19 digits. Example: `661557499056619520`',
            });
            return;
          }
          try {
            const discordIdResponse = await fetch(`${API_BASE_URL}/api/discord/get-steam-id?discordId=${query}`);
            if (discordIdResponse.ok) {
              const discordIdData = await discordIdResponse.json();
              if (discordIdData.steamId) {
                steamId = discordIdData.steamId;
                profile = await getSteamProfile(steamId);
                searchMethod = 'Discord ID';
              } else {
                await interaction.editReply({
                  content: `❌ **Discord Account Not Connected**\n\nThe Discord ID "${query}" is not connected to a Steam account.\n\nThey need to:\n1. Visit https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord"`,
                });
                return;
              }
            } else {
              await interaction.editReply({
                content: `❌ **Discord ID Not Found**\n\nCould not find Discord connection for ID: "${query}"\n\nThe user may not have connected their Discord account to SkinVaults.`,
              });
              return;
            }
          } catch (error) {
            await interaction.editReply({
              content: '❌ **Error**\n\nFailed to lookup Discord ID. Please try again later.',
            });
            return;
          }
        } else {
          // Invalid platform (should not happen, but handle gracefully)
          await interaction.editReply({
            content: '❌ **Invalid Platform**\n\nPlease choose one of: Steam64 ID, Steam Username, Discord Username, or Discord ID.',
          });
          return;
        }

        if (!steamId || !profile) {
          await interaction.editReply({
            content: '❌ **Profile Not Found**\n\nCould not load Steam profile. The profile might be private or invalid.',
          });
          return;
        }

        // Check if viewing own profile or other player
        const viewerSteamId = await getSteamIdFromDiscord(user.id);
        const viewingOwnProfile = steamId === viewerSteamId;
        const playerIsPro = await checkProStatus(steamId);
        const viewerIsPro = viewerSteamId ? await checkProStatus(viewerSteamId) : false;

        // Get stats
        let stats = null;
        try {
          const statsResponse = await fetch(`${API_BASE_URL}/api/steam/stats?id=${steamId}`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            const ps = statsData?.playerstats;
            const s = ps?.stats;
            if (s && Array.isArray(s)) {
              const statsObj = {};
              s.forEach((item) => {
                if (item.name && item.value !== undefined) {
                  statsObj[item.name] = item.value;
                }
              });
              stats = statsObj;
            }
          }
        } catch (error) {
          // Stats are optional
        }

        // Get top 3 weapons (returns immediately, doesn't wait)
        const topWeapons = await getTopWeapons(steamId, 3);

        const vaultUrl = `https://skinvaults.online/inventory/${steamId}`;
        const embed = new EmbedBuilder()
          .setTitle(`👤 ${profile.name}`)
          .setColor(0x5865F2)
          .setURL(vaultUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

        // Set profile avatar
        if (profile.avatar) {
          embed.setThumbnail(profile.avatar);
        }

        // Add Steam ID and search method
        embed.addFields({ name: '🆔 Steam64 ID', value: steamId, inline: false });
        if (searchMethod) {
          embed.addFields({ name: '🔍 Found via', value: searchMethod, inline: true });
        }

        // Add stats if available
        if (stats) {
          const kills = Number(stats.total_kills ?? 0);
          const deaths = Number(stats.total_deaths ?? 0);
          const matchesWon = Number(stats.total_matches_won ?? 0);
          const hsKills = Number(stats.total_kills_headshot ?? 0);
          const totalDamage = Number(stats.total_damage_done ?? 0);
          const roundsPlayed = Number(stats.total_rounds_played ?? 0);
          const mvps = Number(stats.total_mvps ?? 0);

          const kd = deaths > 0 ? (kills / deaths) : kills > 0 ? kills : 0;
          const hs = kills > 0 ? (hsKills / kills) * 100 : 0;
          const adr = roundsPlayed > 0 ? (totalDamage / roundsPlayed) : 0;

          // Basic stats (always shown)
          embed.addFields(
            { name: '💀 Kills', value: kills.toLocaleString(), inline: true },
            { name: '☠️ Deaths', value: deaths.toLocaleString(), inline: true },
            { name: '📈 K/D Ratio', value: kd.toFixed(2), inline: true },
            { name: '🏆 Wins', value: matchesWon.toLocaleString(), inline: true },
            { name: '🎯 HS %', value: `${hs.toFixed(1)}%`, inline: true }
          );

          // Advanced stats (Pro-only, like on website)
          // Show if: viewing own profile and you're pro, OR you're pro viewing anyone
          if ((viewingOwnProfile && playerIsPro) || viewerIsPro) {
            if (mvps > 0) {
              embed.addFields({ name: '⭐ MVPs', value: mvps.toLocaleString(), inline: true });
            }
            if (adr > 0) {
              embed.addFields({ name: '💜 ADR', value: adr.toFixed(1), inline: true });
            }
            if (roundsPlayed > 0) {
              embed.addFields({ name: '🔄 Rounds Played', value: roundsPlayed.toLocaleString(), inline: true });
            }
            if (totalDamage > 0) {
              embed.addFields({ name: '💥 Total Damage', value: totalDamage.toLocaleString(), inline: true });
            }
          } else if (!viewingOwnProfile) {
            embed.addFields({
              name: '🔒 Advanced Stats',
              value: 'Upgrade to **PRO** to see advanced stats for other players!\n\n[Get PRO](https://skinvaults.online/pro)',
              inline: false
            });
          }
        } else {
          embed.addFields({ name: '📊 Stats', value: 'Profile is private or stats unavailable', inline: false });
        }

        // Add top 3 weapons
        if (topWeapons.length > 0) {
          const weaponsList = topWeapons.map((weapon, index) => {
            const priceText = weapon.price || 'No price data';
            return `${index + 1}. **${weapon.name}** - ${priceText}`;
          }).join('\n');

          embed.addFields({
            name: '🔫 Top 3 Weapons',
            value: weaponsList,
            inline: false,
          });
        }

        embed.setDescription(`[View Full Profile](${vaultUrl})`);

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error getting player:', error);
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to load player data. Please try again later.',
        });
      }

    } else if (commandName === 'compare') {
      await interaction.deferReply({ ephemeral: true });

      const item1Query = interaction.options.getString('item1');
      const item2Query = interaction.options.getString('item2');
      const item3Query = interaction.options.getString('item3');

      if (!item1Query || !item2Query) {
        await interaction.editReply({
          content: '❌ **Missing Items**\n\nPlease provide at least 2 items to compare. Example: `/compare item1: "AK-47 Redline" item2: "M4A4 Asiimov"`',
        });
        return;
      }

      try {
        // Search for items
        const items = [];
        const queries = [item1Query, item2Query, item3Query].filter(Boolean);

        for (const query of queries) {
          const searchResult = await searchItem(query);
          if (searchResult) {
            const price = await getItemPrice(searchResult.market_hash_name, '3');
            items.push({
              name: searchResult.name || searchResult.market_hash_name,
              marketHashName: searchResult.market_hash_name,
              price: price ? (price.lowest_price || price.lowest || price.median_price) : null,
              image: searchResult.image,
              id: searchResult.id,
            });
          } else {
            items.push({
              name: query,
              marketHashName: query,
              price: null,
              image: null,
              id: null,
            });
          }
        }

        if (items.length < 2) {
          await interaction.editReply({
            content: '❌ **Items Not Found**\n\nCould not find enough items to compare. Make sure the item names are correct.',
          });
          return;
        }

        // Build compare URL
        const itemIds = items.filter(i => i.id).map(i => i.id);
        let compareUrl = '';
        if (itemIds.length === 2) {
          compareUrl = `https://skinvaults.online/compare?id1=${encodeURIComponent(itemIds[0])}&id2=${encodeURIComponent(itemIds[1])}`;
        } else if (itemIds.length === 3) {
          compareUrl = `https://skinvaults.online/compare?id1=${encodeURIComponent(itemIds[0])}&id2=${encodeURIComponent(itemIds[1])}&id3=${encodeURIComponent(itemIds[2])}`;
        } else {
          // Fallback to market hash names
          const names = items.map(i => i.marketHashName).filter(Boolean);
          compareUrl = `https://skinvaults.online/compare?name1=${encodeURIComponent(names[0])}&name2=${encodeURIComponent(names[1])}`;
        }

        const embed = new EmbedBuilder()
          .setTitle('⚖️ Compare Skins')
          .setColor(0x5865F2)
          .setURL(compareUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

        // Add items to embed
        items.forEach((item, index) => {
          const priceText = item.price || 'No price data';
          const itemUrl = item.id
            ? `https://skinvaults.online/item/${encodeURIComponent(item.id)}`
            : `https://skinvaults.online/item/${encodeURIComponent(item.marketHashName)}`;

          embed.addFields({
            name: `${index + 1}. ${item.name}`,
            value: `💰 **Price:** ${priceText}\n🔗 [View Item](${itemUrl})`,
            inline: false,
          });
        });

        embed.setDescription(`[View Full Comparison](${compareUrl})`);

        // Set thumbnail from first item if available
        if (items[0]?.image) {
          embed.setThumbnail(items[0].image);
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error comparing items:', error);
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to compare items. Please try again later.',
        });
      }

    } else if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 SkinVaults Bot Help')
        .setDescription('Commands and features available:')
        .setColor(0x5865F2)
        .addFields(
          {
            name: '📋 `/wishlist`',
            value: 'View your wishlist with current prices',
            inline: false,
          },
          {
            name: '👤 `/player <query>`',
            value: 'Search for a player by Steam ID, Discord username, or Steam username',
            inline: false,
          },
          {
            name: '🔔 `/alerts`',
            value: 'View your active price alerts',
            inline: false,
          },
          {
            name: '📦 `/inventory`',
            value: 'View your inventory summary',
            inline: false,
          },
          {
            name: '💰 `/price <item>`',
            value: 'Check the current price of a CS2 skin',
            inline: false,
          },
          {
            name: '💎 `/vault`',
            value: 'View your total vault value and statistics',
            inline: false,
          },
          {
            name: '📊 `/stats`',
            value: 'View your CS2 player statistics',
            inline: false,
          },
          {
            name: '⚖️ `/compare <item1> <item2> [item3]`',
            value: 'Compare up to 3 CS2 skins side by side',
            inline: false,
          },
          {
            name: '❓ `/help`',
            value: 'Show this help message',
            inline: false,
          },
          {
            name: '👑 `/pro`',
            value: 'Check your Pro subscription status',
            inline: false,
          },
          {
            name: '🛒 `/shop`',
            value: 'View and purchase Pro subscriptions and consumables',
            inline: false,
          },
          {
            name: '🌐 `/website`',
            value: 'Get a link to the SkinVaults website',
            inline: false,
          },
          {
            name: '🔗 Links',
            value: '[Website](https://skinvaults.online) | [Inventory](https://skinvaults.online/inventory) | [Wishlist](https://skinvaults.online/wishlist) | [Pro](https://skinvaults.online/pro)',
            inline: false,
          }
        )
        .setFooter({ text: 'SkinVaults - Premium CS2 Analytics' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (commandName === 'pro') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);

      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first.\n\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can use this command!',
        });
        return;
      }

      try {
        const proResponse = await fetch(`${API_BASE_URL}/api/user/pro?id=${steamId}`);
        if (!proResponse.ok) {
          await interaction.editReply({
            content: '❌ **Error**\n\nFailed to check Pro status. Please try again later.',
          });
          return;
        }

        const proData = await proResponse.json();
        const isPro = proData?.proUntil && new Date(proData.proUntil) > new Date();
        const proUntil = proData?.proUntil ? new Date(proData.proUntil) : null;

        const embed = new EmbedBuilder()
          .setTitle('👑 Your Pro Status')
          .setColor(isPro ? 0x5865F2 : 0x808080)
          .setURL('https://skinvaults.online/pro')
          .setTimestamp()
          .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

        if (isPro && proUntil) {
          const daysRemaining = Math.ceil((proUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const formattedDate = proUntil.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          embed.setDescription(`✅ **You have an active Pro subscription!**`);
          embed.addFields(
            { name: '📅 Expires', value: formattedDate, inline: true },
            { name: '⏰ Days Remaining', value: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`, inline: true },
            { name: '🎁 Benefits', value: '• Unlimited wishlist items\n• Unlimited price alerts\n• Advanced stats\n• Discord bot features', inline: false }
          );
        } else {
          embed.setDescription(`❌ **You don't have an active Pro subscription.**`);
          embed.addFields(
            { name: '💡 Upgrade to Pro', value: 'Get unlimited features and support SkinVaults!\n\nUse `/shop` to view available plans.', inline: false },
            { name: '🎁 Benefits', value: '• Unlimited wishlist items\n• Unlimited price alerts\n• Advanced stats\n• Discord bot features', inline: false }
          );
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error checking Pro status:', error);
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to check Pro status. Please try again later.',
        });
      }

    } else if (commandName === 'shop') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);

      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVaults first.\n\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can purchase items!',
        });
        return;
      }

      try {
        // Check for promo codes
        let promoCode = null;
        try {
          const themes = ['christmas', 'halloween', 'easter', 'sinterklaas', 'newyear', 'oldyear'];
          for (const theme of themes) {
            const giftResponse = await fetch(`${API_BASE_URL}/api/gift/claim?steamId=${steamId}&theme=${theme}`);
            if (giftResponse.ok) {
              const giftData = await giftResponse.json();
              if (giftData.claimed && giftData.reward?.type === 'promo_code' && giftData.reward?.value) {
                promoCode = giftData.reward.value;
                break;
              }
            }
          }
        } catch (error) {
          // Ignore errors checking promo codes
        }

        const embed = new EmbedBuilder()
          .setTitle('🛒 SkinVaults Shop')
          .setDescription('Purchase Pro subscriptions and consumables')
          .setColor(0x5865F2)
          .setURL('https://skinvaults.online/pro')
          .setTimestamp()
          .setFooter({ text: 'SkinVaults', iconURL: 'https://skinvaults.online/icon.png' });

        // Pro Subscription Plans
        embed.addFields({
          name: '👑 Pro Subscriptions',
          value: '**1 Month** - €9.99\n**3 Months** - €24.99 (Save €4.98)\n**6 Months** - €44.99 (Save €14.95)',
          inline: false,
        });

        // Consumables (available now)
        embed.addFields({
          name: '🎁 Consumables',
          value: '**Wishlist Slots** - €1.99 per slot\n**Export Boost** - €1.49 (10 extra exports)\n**Scan Boost** - €2.49 (faster price scans)\n**Cache Boost** - €1.99 (longer cache duration)\n\n*Price Trackers are Pro-only features*',
          inline: false,
        });

        if (promoCode) {
          embed.addFields({
            name: '🎟️ Active Promo Code',
            value: `You have an active promo code: **${promoCode}**\n\nThis will automatically apply a 20% discount when purchasing!`,
            inline: false,
          });
        }

        embed.addFields({
          name: '💳 How to Purchase',
          value: `1. Click the button below to visit the shop\n2. Select your plan or consumable\n3. Complete checkout with Stripe\n4. Your purchase will activate automatically`,
          inline: false,
        });

        // Create checkout URL with Steam ID
        const checkoutUrl = `https://skinvaults.online/shop?steamId=${steamId}${promoCode ? `&promo=${promoCode}` : ''}`;

        await interaction.editReply({
          embeds: [embed],
          components: [
            {
              type: 1, // ACTION_ROW
              components: [
                {
                  type: 2, // BUTTON
                  style: 5, // LINK
                  label: '🛒 Visit Shop',
                  url: checkoutUrl,
                },
                {
                  type: 2, // BUTTON
                  style: 5, // LINK
                  label: '🛒 View Shop',
                  url: 'https://skinvaults.online/shop',
                },
                {
                  type: 2, // BUTTON
                  style: 5, // LINK
                  label: '👑 View Pro',
                  url: 'https://skinvaults.online/pro',
                },
              ],
            },
          ],
        });
      } catch (error) {
        console.error('Error showing shop:', error);
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to load shop. Please try again later.',
        });
      }

    } else if (commandName === 'website') {
      const embed = new EmbedBuilder()
        .setTitle('🌐 SkinVaults Website')
        .setDescription('Visit the SkinVaults website to manage your inventory, wishlist, and more!')
        .setColor(0x5865F2)
        .setURL('https://skinvaults.online')
        .addFields(
          {
            name: '🔗 Quick Links',
            value: '[🏠 Home](https://skinvaults.online)\n[📦 Inventory](https://skinvaults.online/inventory)\n[📋 Wishlist](https://skinvaults.online/wishlist)\n[👑 Pro](https://skinvaults.online/pro)',
            inline: false,
          }
        )
        .setFooter({ text: 'SkinVaults - Premium CS2 Analytics' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (commandName === 'currency') {
      await interaction.deferReply({ ephemeral: true });

      const chosen = interaction.options.getString('currency');
      const ok = await setCurrencyPreference(user.id, chosen);
      if (!ok) {
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to save your currency preference. Please try again later.',
        });
        return;
      }

      const label = chosen === '1' ? 'USD ($)' : 'EUR (€)';
      await interaction.editReply({
        content: `✅ **Currency Updated**\n\nYour SkinVaults bot currency is now set to **${label}**.`,
      });
    }
  } catch (error) {
    console.error('Error handling command:', error);
    const errorMessage = interaction.deferred
      ? { content: '❌ An error occurred while processing your command. Please try again later.' }
      : { content: '❌ An error occurred while processing your command. Please try again later.', ephemeral: true };

    try {
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (replyError) {
      console.error('Error sending error message:', replyError);
    }
  }
});

// Helper function to get or create a channel
async function getOrCreateChannel(guild, channelName, options = {}) {
  try {
    // Try to find exact match first
    let channel = guild.channels.cache.find(
      ch => ch.name.toLowerCase() === channelName.toLowerCase() && ch.type === 0
    );

    if (!channel) {
      // Try to find channel with name in it
      channel = guild.channels.cache.find(
        ch => ch.name.toLowerCase().includes(channelName.toLowerCase()) && ch.type === 0
      );
    }

    if (!channel && options.create !== false) {
      log(`⚠️ Channel #${channelName} not found in ${guild.name}, creating one...`);
      const category = options.category
        ? guild.channels.cache.find(
          cat => cat.name.toLowerCase().includes(options.category.toLowerCase()) && cat.type === 4
        )
        : guild.channels.cache.find(
          cat => cat.name.toLowerCase().includes('information') && cat.type === 4
        );

      channel = await guild.channels.create({
        name: channelName,
        type: 0, // Text channel
        parent: category?.id,
        topic: options.topic || `SkinVaults Community - ${channelName}`,
        position: options.position,
      });
      log(`✅ Created channel: #${channel.name}`);
    }

    return channel;
  } catch (error) {
    log(`❌ Error getting/creating channel ${channelName}: ${error.message}`);
    return null;
  }
}

// Helper function to safely mention a channel (returns mention if exists, otherwise name)
function safeChannelMention(channel) {
  if (channel) {
    return `<#${channel.id}>`;
  }
  return '#channel-not-found';
}

// Get or create welcome channel
async function getWelcomeChannel(guild) {
  return await getOrCreateChannel(guild, 'welcome', {
    category: 'information',
    topic: 'Welcome to SkinVaults Community! Read the rules and get started.',
    position: 0,
  });
}

// Get or create rules channel
async function getRulesChannel(guild) {
  return await getOrCreateChannel(guild, 'rules', {
    category: 'information',
    topic: 'Server rules and guidelines',
    position: 1,
  });
}

// Get or create FAQ channel
async function getFAQChannel(guild) {
  return await getOrCreateChannel(guild, 'faq', {
    category: 'information',
    topic: 'Frequently asked questions about SkinVaults',
    position: 2,
  });
}

// Get or create general channel
async function getGeneralChannel(guild) {
  return await getOrCreateChannel(guild, 'general', {
    category: 'general',
    topic: 'General chat and discussions',
    position: 0,
  });
}

// Get or create support channel
async function getSupportChannel(guild) {
  return await getOrCreateChannel(guild, 'support', {
    category: 'support',
    topic: 'Get help with SkinVaults website and features',
    position: 0,
  });
}

// Setup welcome message in welcome channel
async function setupWelcomeMessage(guild) {
  try {
    const welcomeChannel = await getWelcomeChannel(guild);
    if (!welcomeChannel) return;

    // Get all channels we need to mention
    const rulesChannel = await getRulesChannel(guild);
    const generalChannel = await getGeneralChannel(guild);
    const faqChannel = await getFAQChannel(guild);
    const supportChannel = await getSupportChannel(guild);

    const pinned = await welcomeChannel.messages.fetchPinned().catch(() => null);
    const pinnedExistingMessage = pinned?.find(
      msg => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    const messages = await welcomeChannel.messages.fetch({ limit: 50 });
    const existingMessage = pinnedExistingMessage || messages.find(
      msg => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    if (existingMessage) {
      log('✅ Welcome message already exists');
      // Update it with correct channel mentions
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('✨ Welcome to SkinVaults Community!')
        .setDescription(
          'Welcome to the official Discord server for **SkinVaults** - Your CS2 skin tracking and inventory management platform!\n\n' +
          '**Get Started:**\n' +
          `1️⃣ Read the rules in ${safeChannelMention(rulesChannel)}\n` +
          '2️⃣ Connect your Discord account on [skinvaults.online](https://skinvaults.online/inventory)\n' +
          '3️⃣ Use `/help` to see all bot commands\n' +
          `4️⃣ Join the conversation in ${safeChannelMention(generalChannel)}\n\n` +
          '**Quick Links:**\n' +
          '🌐 [Website](https://skinvaults.online) | 📦 [Inventory](https://skinvaults.online/inventory) | 👑 [Pro](https://skinvaults.online/pro)\n\n' +
          '**Need Help?**\n' +
          `Check ${safeChannelMention(faqChannel)} or ask in ${safeChannelMention(supportChannel)}\n\n` +
          'Enjoy your stay! 🎉'
        )
        .setColor(0x5865F2)
        .setThumbnail('https://skinvaults.online/icon.png')
        .setFooter({ text: 'SkinVaults Community', iconURL: 'https://skinvaults.online/icon.png' })
        .setTimestamp();

      try {
        await existingMessage.edit({ embeds: [welcomeEmbed] });
        log('✅ Updated welcome message with correct channel mentions');
      } catch (error) {
        log(`⚠️ Could not update welcome message: ${error.message}`);
      }
      return existingMessage;
    }

    // Create welcome embed with proper channel mentions
    const welcomeEmbed = new EmbedBuilder()
      .setTitle('✨ Welcome to SkinVaults Community!')
      .setDescription(
        'Welcome to the official Discord server for **SkinVaults** - Your CS2 skin tracking and inventory management platform!\n\n' +
        '**Get Started:**\n' +
        `1️⃣ Read the rules in ${safeChannelMention(rulesChannel)}\n` +
        '2️⃣ Connect your Discord account on [skinvaults.online](https://skinvaults.online/inventory)\n' +
        '3️⃣ Use `/help` to see all bot commands\n' +
        `4️⃣ Join the conversation in ${safeChannelMention(generalChannel)}\n\n` +
        '**Quick Links:**\n' +
        '🌐 [Website](https://skinvaults.online) | 📦 [Inventory](https://skinvaults.online/inventory) | 👑 [Pro](https://skinvaults.online/pro)\n\n' +
        '**Need Help?**\n' +
        `Check ${safeChannelMention(faqChannel)} or ask in ${safeChannelMention(supportChannel)}\n\n` +
        'Enjoy your stay! 🎉'
      )
      .setColor(0x5865F2)
      .setThumbnail('https://skinvaults.online/icon.png')
      .setFooter({ text: 'SkinVaults Community', iconURL: 'https://skinvaults.online/icon.png' })
      .setTimestamp();

    const message = await welcomeChannel.send({ embeds: [welcomeEmbed] });
    try {
      await message.pin();
    } catch (error) {
      log(`⚠️ Could not pin welcome message: ${error.message}`);
    }
    log('✅ Welcome message posted in #welcome');
    return message;
  } catch (error) {
    log(`❌ Error setting up welcome message: ${error.message}`);
    console.error(error);
  }
}

// Setup rules in rules channel
async function setupRules(guild) {
  try {
    const rulesChannel = await getRulesChannel(guild);
    if (!rulesChannel) return;

    // Check if rules already exist
    const messages = await rulesChannel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(
      msg => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    if (existingMessage) {
      log('✅ Rules message already exists');
      return existingMessage;
    }

    // Create rules embed
    const rulesEmbed = new EmbedBuilder()
      .setTitle('📋 Server Rules')
      .setDescription('Please follow these rules to keep our community friendly and safe!')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '1️⃣ Be Respectful',
          value: 'Treat all members with respect. No harassment, hate speech, or discrimination.',
          inline: false,
        },
        {
          name: '2️⃣ No Spam',
          value: 'Don\'t spam messages, links, or advertisements. Keep messages relevant to the channel topic.',
          inline: false,
        },
        {
          name: '3️⃣ Keep It CS2 Related',
          value: 'This server is for CS2 skin discussions, trading, and SkinVaults features. Keep off-topic discussions to a minimum.',
          inline: false,
        },
        {
          name: '4️⃣ No Scamming',
          value: 'Scamming or attempting to scam other members will result in an immediate ban. Trade at your own risk.',
          inline: false,
        },
        {
          name: '5️⃣ Use Appropriate Channels',
          value: 'Post in the correct channels. Check channel descriptions for guidance.',
          inline: false,
        },
        {
          name: '6️⃣ Follow Discord ToS',
          value: 'All Discord Terms of Service apply. Violations will result in a ban.',
          inline: false,
        },
        {
          name: '7️⃣ No NSFW Content',
          value: 'Keep all content appropriate. No NSFW images, links, or discussions.',
          inline: false,
        },
        {
          name: '8️⃣ Listen to Staff',
          value: 'Moderators and admins have final say. If you have concerns, DM a staff member.',
          inline: false,
        }
      )
      .setFooter({ text: 'Breaking these rules may result in warnings, mutes, or bans', iconURL: 'https://skinvaults.online/icon.png' })
      .setTimestamp();

    const message = await rulesChannel.send({ embeds: [rulesEmbed] });
    log('✅ Rules posted in #rules');
    return message;
  } catch (error) {
    log(`❌ Error setting up rules: ${error.message}`);
    console.error(error);
  }
}

// Setup FAQ in FAQ channel
async function setupFAQ(guild) {
  try {
    const faqChannel = await getFAQChannel(guild);
    if (!faqChannel) return;

    // Check if FAQ already exists
    const messages = await faqChannel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(
      msg => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    if (existingMessage) {
      log('✅ FAQ message already exists');
      return existingMessage;
    }

    // Get channels for mentions
    const supportChannel = await getSupportChannel(guild);
    const generalChannel = await getGeneralChannel(guild);

    // Create FAQ embed
    const faqEmbed = new EmbedBuilder()
      .setTitle('❓ Frequently Asked Questions (FAQ)')
      .setDescription('Common questions about SkinVaults and how to use our platform.')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '🤔 What is SkinVaults?',
          value: 'SkinVaults is a CS2 skin tracking and inventory management platform. Track your inventory, get price alerts, manage your wishlist, and more!',
          inline: false,
        },
        {
          name: '🔗 How do I connect my Discord account?',
          value: '1. Visit [skinvaults.online/inventory](https://skinvaults.online/inventory)\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile settings\n4. Authorize the connection',
          inline: false,
        },
        {
          name: '📦 How do I sync my inventory?',
          value: 'Your inventory syncs automatically when you visit the inventory page. Make sure your Steam profile is set to public for best results.',
          inline: false,
        },
        {
          name: '💰 How do price alerts work?',
          value: 'Set up price alerts on items you\'re interested in. You\'ll get notified via Discord DM when the price reaches your target. Use `/alerts` to manage your alerts.',
          inline: false,
        },
        {
          name: '👑 What is Pro and what does it include?',
          value: 'Pro is a subscription that unlocks:\n• Unlimited wishlist items\n• Unlimited price alerts\n• Advanced CS2 stats (ADR, MVPs, etc.)\n• Priority support\n• Discord bot features\n\nUse `/pro` to check your status or `/shop` to purchase.',
          inline: false,
        },
        {
          name: '🤖 What Discord bot commands are available?',
          value: 'Use `/help` to see all available commands. Popular commands:\n• `/price <item>` - Check item price\n• `/inventory` - View your inventory\n• `/wishlist` - View your wishlist\n• `/vault` - View total vault value\n• `/stats` - View CS2 stats',
          inline: false,
        },
        {
          name: '❌ My inventory isn\'t loading. What should I do?',
          value: `1. Make sure your Steam profile is public\n2. Check if your Steam inventory is set to public\n3. Try refreshing the page\n4. Ask for help in ${safeChannelMention(supportChannel)}`,
          inline: false,
        },
        {
          name: '💳 How do I purchase Pro?',
          value: '1. Use `/shop` to view available plans\n2. Click the shop link\n3. Select your plan\n4. Complete checkout with Stripe\n5. Your Pro status activates automatically',
          inline: false,
        },
        {
          name: '🔔 How do I get price alerts?',
          value: '1. Visit [skinvaults.online](https://skinvaults.online)\n2. Find an item you want to track\n3. Click "Set Alert"\n4. Choose your target price\n5. You\'ll get a Discord DM when the price is reached',
          inline: false,
        },
        {
          name: '📊 Are my stats accurate?',
          value: 'Stats are pulled directly from Steam\'s API. Make sure your Steam profile and game details are set to public for accurate stats.',
          inline: false,
        },
        {
          name: '🆘 I need more help!',
          value: `If you can't find your answer here:\n• Ask in ${safeChannelMention(supportChannel)}\n• Chat with the community in ${safeChannelMention(generalChannel)}\n• Check our [website](https://skinvaults.online) for more info`,
          inline: false,
        }
      )
      .setFooter({ text: 'Have a question not listed here? Ask in #support!', iconURL: 'https://skinvaults.online/icon.png' })
      .setTimestamp();

    const message = await faqChannel.send({ embeds: [faqEmbed] });
    log('✅ FAQ posted in #faq');
    return message;
  } catch (error) {
    log(`❌ Error setting up FAQ: ${error.message}`);
    console.error(error);
  }
}

// Send welcome DM to new member
async function sendWelcomeDM(member) {
  try {
    const guild = member.guild;
    const rulesChannel = await getRulesChannel(guild);
    const supportChannel = await getSupportChannel(guild);
    const generalChannel = await getGeneralChannel(guild);

    const welcomeDM = new EmbedBuilder()
      .setTitle('👋 Welcome to SkinVaults Community!')
      .setDescription(
        `Hey ${member.user.username}! 👋\n\n` +
        'Thanks for joining the **SkinVaults Community** Discord server!\n\n' +
        '**Get Started:**\n' +
        `1. Read the rules in ${safeChannelMention(rulesChannel)}\n` +
        '2. Connect your Discord account on [skinvaults.online](https://skinvaults.online/inventory)\n' +
        '3. Use `/help` to see all available bot commands\n\n' +
        '**What is SkinVaults?**\n' +
        'SkinVaults is a platform to track your CS2 inventory, get price alerts, manage your wishlist, and more!\n\n' +
        '**Quick Links:**\n' +
        '🌐 [Website](https://skinvaults.online)\n' +
        '📦 [Inventory](https://skinvaults.online/inventory)\n' +
        '👑 [Pro](https://skinvaults.online/pro)\n\n' +
        `If you have any questions, feel free to ask in ${safeChannelMention(supportChannel)} or ${safeChannelMention(generalChannel)}!\n\n` +
        'Enjoy your stay! 🎮'
      )
      .setColor(0x5865F2)
      .setThumbnail('https://skinvaults.online/icon.png')
      .setFooter({ text: 'SkinVaults Community', iconURL: 'https://skinvaults.online/icon.png' })
      .setTimestamp();

    await member.send({ embeds: [welcomeDM] });
    log(`✅ Sent welcome DM to ${member.user.tag}`);
  } catch (error) {
    // User might have DMs disabled, that's okay
    if (error.code === 50007) {
      log(`⚠️ Could not send welcome DM to ${member.user.tag}: DMs disabled`);
    } else {
      log(`⚠️ Error sending welcome DM to ${member.user.tag}: ${error.message}`);
    }
  }
}

// Send welcome message in welcome channel
async function sendWelcomeChannelMessage(member) {
  try {
    const guild = member.guild;
    const welcomeChannel = await getWelcomeChannel(guild);
    if (!welcomeChannel) return;

    const rulesChannel = await getRulesChannel(guild);
    const generalChannel = await getGeneralChannel(guild);

    const welcomeMessage = new EmbedBuilder()
      .setTitle('🎉 New Member Joined!')
      .setDescription(
        `Welcome to the server, <@${member.id}>! 👋\n\n` +
        '**Get Started:**\n' +
        `📋 Read the ${safeChannelMention(rulesChannel)}\n` +
        '🔗 Connect your Discord on [skinvaults.online](https://skinvaults.online/inventory)\n' +
        `💬 Say hi in ${safeChannelMention(generalChannel)}\n\n` +
        'Enjoy your stay! 🎮'
      )
      .setColor(0x5865F2)
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({ text: `Member #${guild.memberCount}`, iconURL: 'https://skinvaults.online/icon.png' })
      .setTimestamp();

    await welcomeChannel.send({ embeds: [welcomeMessage] });
    log(`✅ Posted welcome message for ${member.user.tag} in #welcome`);
  } catch (error) {
    log(`❌ Error posting welcome message: ${error.message}`);
    console.error(error);
  }
}

// Get or create a role by name
async function getOrCreateRole(guild, roleName, options = {}) {
  try {
    // Try to find exact match first
    let role = guild.roles.cache.find(
      r => r.name.toLowerCase() === roleName.toLowerCase()
    );

    if (!role && options.create !== false) {
      log(`⚠️ Role "${roleName}" not found in ${guild.name}, creating one...`);
      role = await guild.roles.create({
        name: roleName,
        color: options.color || 0x808080,
        mentionable: options.mentionable || false,
        reason: 'Auto-created by SkinVaults bot',
      });
      log(`✅ Created role: ${role.name}`);
    }

    return role;
  } catch (error) {
    log(`❌ Error getting/creating role ${roleName}: ${error.message}`);
    return null;
  }
}

// Assign roles based on user status
async function assignRoles(member) {
  try {
    const guild = member.guild;
    const discordId = member.user.id;

    log(`🔍 Checking roles for ${member.user.tag} (${discordId})...`);

    // Get Steam ID from Discord ID
    const steamId = await getSteamIdFromDiscord(discordId);

    // Always assign Member role
    const memberRole = await getOrCreateRole(guild, 'Member', { color: 0x808080 });
    if (memberRole) {
      try {
        await member.roles.add(memberRole);
        log(`✅ Assigned Member role to ${member.user.tag}`);
      } catch (error) {
        log(`⚠️ Could not assign Member role: ${error.message}`);
      }
    }

    // If user has connected Discord, check for other roles
    if (steamId) {
      log(`✅ Found Steam ID for ${member.user.tag}: ${steamId}`);

      // Check if owner
      const isOwner = OWNER_STEAM_IDS.includes(steamId);
      if (isOwner) {
        const ownerRole = await getOrCreateRole(guild, 'Owner', { color: 0xFFD700 }); // Gold
        if (ownerRole) {
          try {
            await member.roles.add(ownerRole);
            log(`✅ Assigned Owner role to ${member.user.tag} (owner detected)`);
          } catch (error) {
            log(`⚠️ Could not assign Owner role: ${error.message}`);
          }
        }
      }

      // Check Pro status
      const isPro = await checkProStatus(steamId);
      if (isPro) {
        const proRole = await getOrCreateRole(guild, 'Pro Member', { color: 0x5865F2 }); // Discord blue
        if (proRole) {
          try {
            await member.roles.add(proRole);
            log(`✅ Assigned Pro Member role to ${member.user.tag} (Pro detected)`);
          } catch (error) {
            log(`⚠️ Could not assign Pro Member role: ${error.message}`);
          }
        }
      }

      // Assign Verified role if Discord is connected
      const verifiedRole = await getOrCreateRole(guild, 'Verified', { color: 0x5865F2 }); // Discord blue
      if (verifiedRole) {
        try {
          await member.roles.add(verifiedRole);
          log(`✅ Assigned Verified role to ${member.user.tag} (Discord connected)`);
        } catch (error) {
          log(`⚠️ Could not assign Verified role: ${error.message}`);
        }
      }
    } else {
      log(`ℹ️ No Steam ID found for ${member.user.tag} - Discord not connected yet`);
    }

  } catch (error) {
    log(`❌ Error assigning roles: ${error.message}`);
    console.error(error);
  }
}

// Handle new member join
client.on('guildMemberAdd', async (member) => {
  try {
    log(`👤 New member joined: ${member.user.tag} (${member.user.id})`);

    // Only process for the main guild
    if (member.guild.id !== GUILD_ID) {
      log(`⚠️ Member joined different guild: ${member.guild.id}, skipping`);
      return;
    }

    // Assign roles based on status (Pro, Owner, Verified, Member)
    await assignRoles(member);

    // Send welcome DM (optional, might fail if DMs disabled)
    await sendWelcomeDM(member);

    // Send welcome message in channel
    await sendWelcomeChannelMessage(member);

  } catch (error) {
    log(`❌ Error handling new member: ${error.message}`);
    console.error(error);
  }
});

// Periodic role sync (if needed)
async function syncAllRoles() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const members = await guild.members.fetch();
  for (const m of members.values()) {
    await assignRoles(m);
    await new Promise(r => setTimeout(r, 200));
  }
}

// Run role sync periodically
setInterval(syncAllRoles, 5 * 60 * 1000);

// Fetch role sync queue from API
async function fetchRoleSyncQueue() {
  try {
    const headers = {};
    if (API_TOKEN) {
      headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }
    headers['Content-Type'] = 'application/json';

    log(`🔍 Fetching role sync queue from ${API_BASE_URL}/api/discord/sync-roles...`);

    // Get sync queue from database via API (we'll create a GET endpoint or use the queue directly)
    // For now, we'll check the database directly via a simple endpoint
    const response = await fetch(`${API_BASE_URL}/api/discord/get-sync-queue`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      // Endpoint might not exist yet, that's okay
      return [];
    }

    const data = await response.json();
    return data.queue || [];
  } catch (error) {
    // Endpoint might not exist, that's okay
    return [];
  }
}

// Process role sync queue
async function processRoleSyncQueue() {
  // Only process if bot is ready
  if (!client.isReady()) {
    return;
  }

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      return;
    }

    // For now, we'll sync roles for all members periodically
    // In the future, we can check a queue
    // This is simpler and ensures roles stay in sync

    // Only sync every 5 minutes to avoid rate limits
    const lastSyncKey = 'last_role_sync';
    const lastSync = client.lastRoleSync || 0;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - lastSync < fiveMinutes) {
      return; // Don't sync too often
    }

    client.lastRoleSync = now;

    log('🔄 Syncing roles for all members...');
    const members = await guild.members.fetch();
    let synced = 0;
    let errors = 0;

    for (const [id, member] of members) {
      try {
        await assignRoles(member);
        synced++;
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        errors++;
        if (errors < 5) { // Only log first 5 errors
          log(`⚠️ Error syncing roles for ${member.user.tag}: ${error.message}`);
        }
      }
    }

    if (synced > 0 || errors > 0) {
      log(`✅ Synced roles for ${synced} members (${errors} errors)`);
    }
  } catch (error) {
    log(`❌ Error processing role sync queue: ${error.message}`);
  }
}

// Poll for queued messages every 5 seconds
setInterval(processQueuedMessages, 5000);

// Poll for role sync every 5 minutes
setInterval(processRoleSyncQueue, 5 * 60 * 1000);

// Bot ready event (using clientReady to avoid deprecation warning)
client.once('clientReady', async () => {
  log(`✅ Discord bot logged in as ${client.user.tag}!`);
  log(`Bot is in ${client.guilds.cache.size} guild(s)`);

  // Set bot presence/status to show as online
  try {
    UpdatePresence();
    setInterval(() => {
      try {
        UpdatePresence();
      } catch {}
    }, 10 * 60 * 1000);
    log('✅ Bot presence set to online');
  } catch (error) {
    log(`⚠️ Failed to set bot presence: ${error.message}`);
  }

  // Register commands
  await registerCommands();

  // Setup guild-specific features
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
      log(`🏠 Setting up features for guild: ${guild.name}`);

      // Setup welcome message, rules, and FAQ
      await setupWelcomeMessage(guild);
      await setupRules(guild);
      await setupFAQ(guild);

      // Sync roles for all existing members (optional - can be disabled if too slow)
      log(`🔄 Syncing roles for existing members...`);
      try {
        const members = await guild.members.fetch();
        let synced = 0;
        let errors = 0;

        for (const [id, member] of members) {
          try {
            await assignRoles(member);
            synced++;
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            errors++;
            log(`⚠️ Error syncing roles for ${member.user.tag}: ${error.message}`);
          }
        }

        log(`✅ Synced roles for ${synced} members (${errors} errors)`);
      } catch (error) {
        log(`⚠️ Error syncing roles for existing members: ${error.message}`);
      }

      log(`✅ Guild setup complete for ${guild.name}`);
    } else {
      log(`⚠️ Guild ${GUILD_ID} not found. Make sure the bot is in the server.`);
    }
  } catch (error) {
    log(`❌ Error setting up guild features: ${error.message}`);
    console.error(error);
  }

  // Process any queued messages immediately
  log('🔄 Checking for queued messages...');
  processQueuedMessages();

  log('🤖 Bot is ready and processing messages!');
  log('⏰ Bot will check for queued messages every 5 seconds...');
});

// Error handling
client.on('error', (error) => {
  log(`❌ Discord client error: ${error.message}`);
  console.error(error);
});

process.on('unhandledRejection', (error) => {
  log(`❌ Unhandled promise rejection: ${error.message}`);
  console.error(error);
});

// Start bot
log('🔐 Attempting to login to Discord...');
client.login(DISCORD_TOKEN).catch((error) => {
  log(`❌ Failed to login: ${error.message}`);
  console.error(error);
  process.exit(1);
});

