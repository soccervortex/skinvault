const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const API_BASE_URL = process.env.API_BASE_URL || 'https://skinvaults.vercel.app';
const API_TOKEN = process.env.DISCORD_BOT_API_TOKEN || '';

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in environment variables');
  process.exit(1);
}

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
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    console.log('Started refreshing application (/) commands.');
    console.log(`Registering ${commands.length} commands:`, commands.map(c => c.name).join(', '));

    // Register commands globally (works for both server and user installs)
    // Global commands can take up to 1 hour to propagate, but work everywhere
    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Successfully registered application commands globally.');
    console.log('📋 Commands registered:', commands.map(c => `/${c.name}`).join(', '));
    console.log('⏳ Global commands may take up to 1 hour to appear in Discord.');
    console.log('💡 Tip: Commands will appear in DMs and servers where the bot is present.');
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
    const headers = API_TOKEN ? { 'Authorization': `Bearer ${API_TOKEN}` } : {};
    const response = await fetch(`${API_BASE_URL}/api/discord/bot-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_TOKEN ? { 'Authorization': `Bearer ${API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ action: 'check_alerts' }),
    });

    if (!response.ok) {
      console.error('Failed to fetch queued messages:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.queue || [];
  } catch (error) {
    console.error('Error fetching queued messages:', error);
    return [];
  }
}

// Send DM to user
async function sendDM(discordId, message) {
  try {
    const user = await client.users.fetch(discordId);
    if (!user) {
      console.error(`User ${discordId} not found`);
      return false;
    }

    await user.send(message);
    console.log(`Sent DM to ${user.username}#${user.discriminator} (${discordId})`);
    return true;
  } catch (error) {
    console.error(`Failed to send DM to ${discordId}:`, error.message);
    return false;
  }
}

// Process queued messages
async function processQueuedMessages() {
  const messages = await fetchQueuedMessages();
  
  for (const msg of messages) {
    await sendDM(msg.discordId, msg.message);
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
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

    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);

    // Search through all datasets
    for (const datasetUrl of datasets) {
      try {
        const response = await fetch(datasetUrl, { cache: 'force-cache' });
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        // First try exact match
        let found = items.find(item => {
          const name = (item.market_hash_name || item.name || '').toLowerCase();
          return name === queryLower;
        });

        if (found) {
          return {
            market_hash_name: found.market_hash_name || found.name,
            name: found.name || found.market_hash_name,
            image: found.image || found.icon_url,
            id: found.id,
          };
        }

        // Then try fuzzy match (all words must be in the name)
        found = items.find(item => {
          const name = (item.market_hash_name || item.name || '').toLowerCase();
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

        // Then try partial match (any word matches)
        found = items.find(item => {
          const name = (item.market_hash_name || item.name || '').toLowerCase();
          return queryWords.some(word => name.includes(word));
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
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  try {
    if (commandName === 'wishlist') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\n1. Go to https://skinvaults.vercel.app/inventory\n2. Sign in with Steam\n3. Click "Connect Discord" in your profile\n\nOnce connected, you can use this command!',
        });
        return;
      }

      const wishlist = await getWishlist(steamId);
      
      if (!wishlist || wishlist.length === 0) {
        await interaction.editReply({
          content: '📝 **Your Wishlist is Empty**\n\nAdd items to your wishlist on SkinVault to track their prices!\n\nVisit: https://skinvaults.vercel.app',
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
        .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.vercel.app/icon.png' });

      // Add thumbnail if first item has image
      if (firstItem?.image) {
        embed.setThumbnail(firstItem.image);
      }

      const fields = itemsToShow.map((item, index) => {
        const price = prices[index];
        const priceText = price?.lowest_price || price?.lowest || price?.median_price || 'No price data';
        const itemUrl = `https://skinvaults.vercel.app/item/${encodeURIComponent(item.market_hash_name || item.key)}`;
        
        return {
          name: `${index + 1}. ${item.name || item.key}`,
          value: `💰 **Price:** ${priceText}\n🔗 [View Item](${itemUrl})`,
          inline: false,
        };
      });

      // Discord embeds have a limit of 25 fields, but we're only showing 10
      embed.addFields(fields);

      if (wishlist.length > 10) {
        embed.setDescription(`Showing first 10 of ${wishlist.length} items\n\nView all items: https://skinvaults.vercel.app/wishlist`);
      }

      await interaction.editReply({ embeds: [embed] });

    } else if (commandName === 'alerts') {
      await interaction.deferReply({ ephemeral: true });

      const steamId = await getSteamIdFromDiscord(user.id);
      
      if (!steamId) {
        await interaction.editReply({
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.vercel.app/inventory',
        });
        return;
      }

      const alerts = await getAlerts(steamId);
      
      if (!alerts || alerts.length === 0) {
        await interaction.editReply({
          content: '🔔 **No Active Alerts**\n\nSet up price alerts on SkinVault to get notified when prices hit your target!\n\nVisit: https://skinvaults.vercel.app',
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
        const itemUrl = `https://skinvaults.vercel.app/item/${encodeURIComponent(alert.marketHashName)}`;
        
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
        embed.setDescription(`Showing first 10 of ${alerts.length} alerts\n\nManage alerts: https://skinvaults.vercel.app/inventory`);
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
            content: `❌ **Item Not Found**\n\nCould not find price data for: "${itemQuery}"\n\n💡 **Tip:** Try a partial name like "snakebite" or "ak redline"\n\nSearch for items on: https://skinvaults.vercel.app`,
          });
          return;
        }
      }

      const priceText = price ? (price.lowest_price || price.lowest || price.median_price || 'No price data') : 'No price data';
      const itemUrl = itemId 
        ? `https://skinvaults.vercel.app/item/${encodeURIComponent(itemId)}`
        : `https://skinvaults.vercel.app/item/${encodeURIComponent(itemName)}`;

      const embed = new EmbedBuilder()
        .setTitle(`💰 ${displayName}`)
        .setDescription(`**Current Price:** ${priceText}`)
        .setColor(0x5865F2)
        .setURL(itemUrl)
        .setTimestamp()
        .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.vercel.app/icon.png' });

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
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.vercel.app/inventory',
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
        
        // Count items
        const itemCount = assets.length;
        const uniqueItems = new Set(descriptions.map(d => d.classid)).size;

        const embed = new EmbedBuilder()
          .setTitle('📦 Your Inventory')
          .setDescription(`**Total Items:** ${itemCount}\n**Unique Items:** ${uniqueItems}`)
          .setColor(0x5865F2)
          .setURL(`https://skinvaults.vercel.app/inventory?steamId=${steamId}`)
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.vercel.app/icon.png' });

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
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.vercel.app/inventory',
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

        const vaultUrl = `https://skinvaults.vercel.app/inventory?steamId=${steamId}`;
        const totalItems = assets.length;
        const uniqueItems = new Set(descriptions.map(d => d.classid)).size;

        // Create main embed
        const embed = new EmbedBuilder()
          .setTitle('💎 Your Vault')
          .setColor(0x5865F2)
          .setURL(vaultUrl)
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.vercel.app/icon.png' });

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
              ? `https://skinvaults.vercel.app/item/${encodeURIComponent(item.marketHashName)}`
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
          content: '❌ **Not Connected**\n\nYou need to connect your Discord account to SkinVault first.\n\nVisit: https://skinvaults.vercel.app/inventory',
        });
        return;
      }

      try {
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
          .setTitle('📊 Your CS2 Stats')
          .setColor(0x5865F2)
          .setURL(`https://skinvaults.vercel.app/inventory?steamId=${steamId}`)
          .setTimestamp()
          .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.vercel.app/icon.png' });

        // Basic stats
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

        // Advanced stats
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
            name: '❓ `/help`',
            value: 'Show this help message',
            inline: false,
          },
          {
            name: '🔗 Links',
            value: '[Website](https://skinvaults.vercel.app) | [Inventory](https://skinvaults.vercel.app/inventory) | [Wishlist](https://skinvaults.vercel.app/wishlist)',
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

// Bot ready event
client.once('ready', async () => {
  console.log(`✅ Discord bot logged in as ${client.user.tag}!`);
  console.log(`Bot is in ${client.guilds.cache.size} guild(s)`);
  
  // Register commands
  await registerCommands();
  
  // Process any queued messages immediately
  processQueuedMessages();
  
  console.log('🤖 Bot is ready and processing messages!');
});

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Start bot
client.login(DISCORD_TOKEN).catch((error) => {
  console.error('Failed to login:', error);
  process.exit(1);
});

