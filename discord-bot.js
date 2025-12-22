const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, SlashCommandBuilder, ActivityType, PresenceUpdateStatus } = require('discord.js');
require('dotenv').config();

// Helper function for timestamped logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const API_BASE_URL = process.env.API_BASE_URL || 'https://skinvaults.online';
const API_TOKEN = process.env.DISCORD_BOT_API_TOKEN || '';

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  log('❌ ERROR: Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in environment variables');
  process.exit(1);
}

log('🚀 Starting Discord bot...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Register slash commands
// Note: For User Installs, commands must be registered globally and the bot must have
// "applications.commands" scope. Global commands can take up to 1 hour to appear.
const commands = [
  new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('View your wishlist with current prices')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with SkinVault bot commands')
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
    .setDescription('Get a link to the SkinVault website')
    .toJSON(),
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    log('Started refreshing application (/) commands.');
    log(`Registering ${commands.length} commands: ${commands.map(c => c.name).join(', ')}`);

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
        log(`   Message ${idx + 1}: Discord ID ${msg.discordId}, timestamp: ${new Date(msg.timestamp).toISOString()}`);
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
      log(`📤 Processing message for Discord ID: ${msg.discordId}`);
      const success = await sendDM(msg.discordId, msg.message);
      if (success) {
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

// Get Steam profile by Steam64 ID
async function getSteamProfile(steamId) {
  try {
    const steamUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return null;
    
    const text = await response.text();
    const name = text.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || "User";
    const avatar = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/)?.[1] || "";
    return { steamId, name, avatar };
  } catch (error) {
    console.error('Error getting Steam profile:', error);
    return null;
  }
}

// Resolve Steam username to Steam64 ID using steamid.io
async function resolveSteamUsername(username) {
  try {
    // Clean username: extract first part before | or special chars
    // "TheRembler | Bloodycase.com" -> "TheRembler"
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
    const invResponse = await fetch(`${API_BASE_URL}/api/steam/inventory?steamId=${steamId}&isPro=false`);
    if (!invResponse.ok) return [];

    const invData = await invResponse.json();
    const assets = invData.assets || [];
    const descriptions = invData.descriptions || [];
    
    const descMap = new Map();
    descriptions.forEach(desc => {
      const key = `${desc.classid}_${desc.instanceid || 0}`;
      descMap.set(key, desc);
    });

    const weapons = [];
    const weaponTypes = [
      'Knife', 'AK-47', 'M4A4', 'AWP', 'Glock', 'USP', 'Desert Eagle', 'P250',
      'Five-SeveN', 'Tec-9', 'CZ75', 'R8', 'P2000', 'Dual Berettas',
      'P90', 'MP9', 'MAC-10', 'UMP-45', 'MP7', 'MP5',
      'FAMAS', 'Galil', 'M4A1-S', 'AUG', 'SG 553', 'SCAR-20',
      'G3SG1', 'SSG 08', 'Nova', 'XM1014', 'Sawed-Off', 'MAG-7',
      'M249', 'Negev'
    ];

    // Collect all weapons first (without prices)
    for (const asset of assets) {
      const key = `${asset.classid}_${asset.instanceid || 0}`;
      const desc = descMap.get(key);
      if (!desc) continue;

      const itemName = desc.market_hash_name || desc.market_name || desc.name;
      if (!itemName) continue;

      const isWeapon = desc.type === 'Weapon' || 
                      weaponTypes.some(weaponType => itemName.includes(weaponType));

      if (isWeapon) {
        weapons.push({
          name: itemName,
          price: null,
          priceValue: 0,
        });
      }
    }

    // Limit to top candidates before fetching prices (to speed up)
    const candidates = weapons.slice(0, limit * 2); // Get a few extra for safety
    
    // Fetch prices in parallel with timeout - return what we have after 3 seconds max
    const pricePromises = candidates.map(async (weapon, index) => {
      try {
        const price = await Promise.race([
          getItemPrice(weapon.name, '3'),
          new Promise(resolve => setTimeout(() => resolve(null), 2000)) // 2 second timeout per price
        ]);
        
        if (price) {
          const priceStr = price.lowest_price || price.lowest || price.median_price;
          if (priceStr) {
            const cleaned = priceStr.replace(/[€$£¥\s]/g, '').replace(/\./g, '').replace(',', '.');
            weapon.priceValue = parseFloat(cleaned) || 0;
            weapon.price = priceStr;
          }
        }
      } catch (error) {
        // Ignore price fetch errors
      }
      return weapon;
    });

    // Wait max 3 seconds total for prices
    const results = await Promise.race([
      Promise.all(pricePromises),
      new Promise(resolve => setTimeout(() => resolve(candidates), 3000))
    ]);

    // Sort by price and return top weapons (even if some don't have prices yet)
    const sorted = (results || candidates).sort((a, b) => b.priceValue - a.priceValue);
    return sorted.slice(0, limit);
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
  }
  
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  try {
    if (commandName === 'wishlist') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can use this command!',
        });
        return;
      }

      const wishlist = await getWishlist(steamId);
      
      if (!wishlist || wishlist.length === 0) {
        await interaction.editReply({
          content: '📝 **Your Wishlist is Empty**\n\nAdd items to your wishlist on SkinVault to track their prices!\n\nVisit: https://skinvaults.online',
        });
        return;
      }

      // Get prices for all items (limit to first 10 for embed)
      const itemsToShow = wishlist.slice(0, 10);
      const pricePromises = itemsToShow.map(item => 
        getItemPrice(item.market_hash_name || item.key, '3')
      );
      const prices = await Promise.all(pricePromises);

      // Create embed with thumbnail from first item
      const firstItem = itemsToShow[0];
      const embed = new EmbedBuilder()
        .setTitle('📋 Your Wishlist')
        .setDescription(`Showing ${itemsToShow.length} of ${wishlist.length} items`)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

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

    } else if (commandName === 'alerts') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.online/inventory',
        });
        return;
      }

      const alerts = await getAlerts(steamId);
      
      if (!alerts || alerts.length === 0) {
        await interaction.editReply({
          content: '🔔 **No Active Alerts**\n\nSet up price alerts on SkinVault to get notified when prices hit your target!\n\nVisit: https://skinvaults.online',
        });
        return;
      }

      // Get current prices for alerts
      const pricePromises = alerts.slice(0, 10).map(alert => 
        getItemPrice(alert.marketHashName, alert.currency)
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
      const price = await getItemPrice(itemName, '3');
      
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
        .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

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

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.online/inventory',
        });
        return;
      }

      try {
        const invResponse = await fetch(`${API_BASE_URL}/api/steam/inventory?steamId=${steamId}&isPro=false`);
        if (!invResponse.ok) {
          await interaction.editReply({
            content: '❌ **Failed to Load Inventory**\n\nCould not fetch your inventory. Please try again later.',
          });
          return;
        }

        const invData = await invResponse.json();
        const assets = invData.assets || [];
        const descriptions = invData.descriptions || [];
        
        // Create a map of classid_instanceid to descriptions
        const descMap = new Map();
        descriptions.forEach(desc => {
          const key = `${desc.classid}_${desc.instanceid || 0}`;
          descMap.set(key, desc);
        });

        // Match assets with descriptions and get item names
        const items = [];
        const itemCounts = new Map(); // Track counts per item name

        for (const asset of assets) {
          const key = `${asset.classid}_${asset.instanceid || 0}`;
          const desc = descMap.get(key);
          if (!desc) continue;

          const itemName = desc.market_hash_name || desc.market_name || desc.name || `Item ${desc.classid}`;
          const amount = asset.amount || 1;
          
          // Track counts
          const currentCount = itemCounts.get(itemName) || 0;
          itemCounts.set(itemName, currentCount + amount);
        }

        // Convert to array and sort alphabetically
        const sortedItems = Array.from(itemCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const totalItems = assets.length;
        const uniqueItems = sortedItems.length;
        const vaultUrl = `https://skinvaults.online/inventory?steamId=${steamId}`;

        const embed = new EmbedBuilder()
          .setTitle('📦 Your Inventory')
          .setColor(0x5865F2)
          .setURL(vaultUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

        // Add summary
        embed.addFields(
          { name: '📊 Summary', value: `**Total Items:** ${totalItems}\n**Unique Items:** ${uniqueItems}`, inline: false }
        );

        // Add items list (limit to 20 to avoid embed limits)
        const itemsToShow = sortedItems.slice(0, 20);
        if (itemsToShow.length > 0) {
          const itemsList = itemsToShow.map((item, index) => {
            const countText = item.count > 1 ? ` (x${item.count})` : '';
            return `${index + 1}. ${item.name}${countText}`;
          }).join('\n');

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

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.online/inventory',
        });
        return;
      }

      try {
        const invResponse = await fetch(`${API_BASE_URL}/api/steam/inventory?steamId=${steamId}&isPro=false`);
        if (!invResponse.ok) {
          await interaction.editReply({
            content: '❌ **Failed to Load Inventory**\n\nCould not fetch your inventory. Please try again later.',
          });
          return;
        }

        const invData = await invResponse.json();
        const assets = invData.assets || [];
        const descriptions = invData.descriptions || [];
        
        // Create a map of classid_instanceid to descriptions
        const descMap = new Map();
        descriptions.forEach(desc => {
          const key = `${desc.classid}_${desc.instanceid || 0}`;
          descMap.set(key, desc);
        });

        // Match assets with descriptions and get prices
        const items = [];
        let totalValue = 0;
        let tradableCount = 0;
        let nonTradableCount = 0;
        let pricedCount = 0;

        for (const asset of assets) {
          const key = `${asset.classid}_${asset.instanceid || 0}`;
          const desc = descMap.get(key);
          if (!desc) continue;

          const itemName = desc.market_hash_name || desc.market_name || desc.name || `Item ${desc.classid}`;
          const isTradable = desc.tradable !== 0 && desc.tradable !== false;
          const isMarketable = desc.marketable !== 0 && desc.marketable !== false;
          
          if (isTradable) tradableCount++;
          else nonTradableCount++;

          // Get price for marketable items
          let price = null;
          let priceValue = 0;
          if (isMarketable && (desc.market_hash_name || desc.market_name)) {
            price = await getItemPrice(desc.market_hash_name || desc.market_name, '3');
            if (price) {
              const priceStr = price.lowest_price || price.lowest || price.median_price;
              if (priceStr) {
                // Parse price (handles formats like "€0,78" or "$1.23")
                const cleaned = priceStr.replace(/[€$£¥\s]/g, '').replace(/\./g, '').replace(',', '.');
                priceValue = parseFloat(cleaned) || 0;
                totalValue += priceValue * (asset.amount || 1);
                pricedCount++;
              }
            }
          }

          items.push({
            name: itemName,
            price: price ? (price.lowest_price || price.lowest || price.median_price) : null,
            priceValue,
            isTradable,
            isMarketable,
            amount: asset.amount || 1,
            marketHashName: desc.market_hash_name || desc.market_name,
          });
        }

        // Sort items by price (highest first)
        items.sort((a, b) => b.priceValue - a.priceValue);

        // Get stats
        let stats = null;
        try {
          const statsResponse = await fetch(`${API_BASE_URL}/api/steam/stats?id=${steamId}`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            // The API returns { playerstats: { stats: [...] } }
            const ps = statsData?.playerstats;
            const s = ps?.stats;
            if (s && Array.isArray(s)) {
              // Convert array format to object format
              const statsObj = {};
              s.forEach(stat => {
                if (stat.name && stat.value !== undefined) {
                  statsObj[stat.name] = stat.value;
                }
              });
              
              // Extract key stats
              const kills = Number(statsObj.total_kills ?? 0);
              const deaths = Number(statsObj.total_deaths ?? 0);
              const matchesWon = Number(statsObj.total_matches_won ?? 0);
              
              stats = {
                total_kills: kills,
                total_deaths: deaths,
                total_wins: matchesWon,
              };
            }
          }
        } catch (error) {
          // Stats are optional
        }

        const vaultUrl = `https://skinvaults.online/inventory?steamId=${steamId}`;
        const totalItems = assets.length;
        const uniqueItems = new Set(descriptions.map(d => d.classid)).size;

        // Create main embed
        const embed = new EmbedBuilder()
          .setTitle('💎 Your Vault')
          .setColor(0x5865F2)
          .setURL(vaultUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

        // Add summary fields
        const totalValueStr = totalValue > 0 ? `€${totalValue.toFixed(2).replace('.', ',')}` : '€0,00';
        embed.addFields(
          { name: '📦 Total Items', value: String(totalItems), inline: true },
          { name: '🔢 Unique Items', value: String(uniqueItems), inline: true },
          { name: '💰 Total Value', value: totalValueStr, inline: true },
          { name: '✅ Tradable Items', value: String(tradableCount), inline: true },
          { name: '🔒 Non-Tradable Items', value: String(nonTradableCount), inline: true },
          { name: '💵 Priced Items', value: String(pricedCount), inline: true }
        );

        // Add stats if available
        if (stats) {
          if (stats.total_kills) embed.addFields({ name: '💀 Total Kills', value: String(stats.total_kills), inline: true });
          if (stats.total_deaths) embed.addFields({ name: '☠️ Total Deaths', value: String(stats.total_deaths), inline: true });
          if (stats.total_kills && stats.total_deaths) {
            const kd = (stats.total_kills / stats.total_deaths).toFixed(2);
            embed.addFields({ name: '📈 K/D Ratio', value: kd, inline: true });
          }
          if (stats.total_wins) embed.addFields({ name: '🏆 Wins', value: String(stats.total_wins), inline: true });
        }

        // Add items (limit to first 10 to avoid embed limits)
        const itemsToShow = items.slice(0, 10);
        if (itemsToShow.length > 0) {
          embed.addFields({ name: '\u200b', value: '**Top Items:**', inline: false });
          
          itemsToShow.forEach((item, index) => {
            const itemUrl = item.marketHashName 
              ? `https://skinvaults.online/item/${encodeURIComponent(item.marketHashName)}`
              : vaultUrl;
            const priceText = item.price || (item.isMarketable ? 'No price data' : 'NOT MARKETABLE');
            const tradableText = item.isTradable ? '✅' : '🔒';
            const amountText = item.amount > 1 ? ` (x${item.amount})` : '';
            
            embed.addFields({
              name: `${index + 1}. ${tradableText} ${item.name}${amountText}`,
              value: `💰 **Price:** ${priceText}\n🔗 [View Item](${itemUrl})`,
              inline: false,
            });
          });

          if (items.length > 10) {
            embed.setDescription(`Showing top 10 of ${items.length} items\n\n[View Full Vault](${vaultUrl})`);
          } else {
            embed.setDescription(`[View Full Vault](${vaultUrl})`);
          }
        } else {
          embed.setDescription(`No items found.\n\n[View Vault](${vaultUrl})`);
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error getting vault:', error);
        await interaction.editReply({
          content: '❌ **Error**\n\nFailed to load vault data. Please try again later.',
        });
      }

    } else if (commandName === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.online/inventory',
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
          .setURL(`https://skinvaults.online/inventory?steamId=${steamId}`)
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

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
              content: `❌ **Steam Username Not Found**\n\nCould not find Steam profile for: "${query}"\n\n💡 **Tips:**\n• Use just the username part (e.g., "TheRembler" instead of "TheRembler | Bloodycase.com")\n• Make sure the Steam custom URL is correct\n• Try using Steam64 ID instead`,
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
              content: `❌ **Discord Username Not Found**\n\nCould not find Discord user: "${query}"\n\n💡 **Make sure:**\n• The user has connected their Discord account to SkinVault\n• You're using the correct Discord username\n• The user is in a server with the bot (if not in database)\n\nOr try using their Steam64 ID instead.`,
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
                content: `❌ **Discord ID Not Found**\n\nCould not find Discord connection for ID: "${query}"\n\nThe user may not have connected their Discord account to SkinVault.`,
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

        const vaultUrl = `https://skinvaults.online/inventory?steamId=${steamId}`;
        const embed = new EmbedBuilder()
          .setTitle(`👤 ${profile.name}`)
          .setColor(0x5865F2)
          .setURL(vaultUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

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
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

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
        .setTitle('🤖 SkinVault Bot Help')
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
            value: 'Get a link to the SkinVault website',
            inline: false,
          },
          {
            name: '🔗 Links',
            value: '[Website](https://skinvaults.online) | [Inventory](https://skinvaults.online/inventory) | [Wishlist](https://skinvaults.online/wishlist) | [Pro](https://skinvaults.online/pro)',
            inline: false,
          }
        )
        .setFooter({ text: 'SkinVault - Premium CS2 Analytics' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (commandName === 'pro') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can use this command!',
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
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

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
            { name: '💡 Upgrade to Pro', value: 'Get unlimited features and support SkinVault!\n\nUse `/shop` to view available plans.', inline: false },
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
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\n1. Go to https://skinvaults.online/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can purchase items!',
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
          .setTitle('🛒 SkinVault Shop')
          .setDescription('Purchase Pro subscriptions and consumables')
          .setColor(0x5865F2)
          .setURL('https://skinvaults.online/pro')
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.online/icon.png' });

        // Pro Subscription Plans
        embed.addFields({
          name: '👑 Pro Subscriptions',
          value: '**1 Month** - €9.99\n**3 Months** - €24.99 (Save €4.98)\n**6 Months** - €44.99 (Save €14.95)',
          inline: false,
        });

        // Consumables (coming soon)
        embed.addFields({
          name: '🎁 Consumables (Coming Soon)',
          value: '**Price Tracker Slots** - Add extra price alerts\n**Wishlist Slots** - Add extra wishlist items\n\n*These will be available soon!*',
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
          value: `1. Click the button below to visit the shop\n2. Select your plan\n3. Complete checkout with Stripe\n4. Your Pro status will activate automatically`,
          inline: false,
        });

        // Create checkout URL with Steam ID
        const checkoutUrl = `https://skinvaults.online/pro?steamId=${steamId}${promoCode ? `&promo=${promoCode}` : ''}`;

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
                  label: '👑 View Pro Page',
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
        .setTitle('🌐 SkinVault Website')
        .setDescription('Visit the SkinVault website to manage your inventory, wishlist, and more!')
        .setColor(0x5865F2)
        .setURL('https://skinvaults.online')
        .addFields(
          {
            name: '🔗 Quick Links',
            value: '[🏠 Home](https://skinvaults.online)\n[📦 Inventory](https://skinvaults.online/inventory)\n[📋 Wishlist](https://skinvaults.online/wishlist)\n[👑 Pro](https://skinvaults.online/pro)\n[⚖️ Compare](https://skinvaults.online/compare)',
            inline: false,
          }
        )
        .setFooter({ text: 'SkinVault - Premium CS2 Analytics' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
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

// Poll for queued messages every 5 seconds
setInterval(processQueuedMessages, 5000);

// Bot ready event (using clientReady to avoid deprecation warning)
client.once('clientReady', async () => {
  log(`✅ Discord bot logged in as ${client.user.tag}!`);
  log(`Bot is in ${client.guilds.cache.size} guild(s)`);
  
  // Set bot presence/status to show as online
  try {
    client.user.setPresence({
      activities: [{
        name: 'CS2 Skin Analytics',
        type: ActivityType.Watching,
      }],
      status: PresenceUpdateStatus.Online,
    });
    log('✅ Bot presence set to online');
  } catch (error) {
    log(`⚠️ Failed to set bot presence: ${error.message}`);
  }
  
  // Register commands
  await registerCommands();
  
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

