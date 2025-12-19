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
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
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
    return data;
  } catch (error) {
    console.error('Error getting price:', error);
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

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('📋 Your Wishlist')
        .setDescription(`Showing ${itemsToShow.length} of ${wishlist.length} items`)
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: 'SkinVault', iconURL: 'https://skinvaults.vercel.app/icon.png' });

      const fields = itemsToShow.map((item, index) => {
        const price = prices[index];
        const priceText = price?.lowest ? price.lowest : 'No price data';
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
        
        return {
          name: `${index + 1}. ${alert.marketHashName}`,
          value: `**Target:** ${condition} ${symbol}${alert.targetPrice.toFixed(2)}\n**Status:** ${status}`,
          inline: false,
        };
      });

      embed.addFields(fields);

      if (alerts.length > 10) {
        embed.setDescription(`Showing first 10 of ${alerts.length} alerts\n\nManage alerts: https://skinvaults.vercel.app/inventory`);
      }

      await interaction.editReply({ embeds: [embed] });

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

