const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, SlashCommandBuilder, ActivityType, PresenceUpdateStatus, PermissionsBitField } = require('discord.js');
require('dotenv').config();

// Helper: timestamped logs
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function fetchBotApi(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const API_BASE_URL = process.env.API_BASE_URL || 'https://www.skinvaults.online';
const API_TOKEN = process.env.DISCORD_BOT_API_TOKEN || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1453751539792347304'; // SkinVaults Community server

function getInviteUrl() {
  const permissions = [
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.SendMessagesInThreads,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.AttachFiles,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.UseExternalEmojis,
    PermissionsBitField.Flags.AddReactions,
  ].reduce((a, b) => a | b, 0n);
  return `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${permissions}&scope=bot%20applications.commands`;
}
const SUPPORT_INVITE_CHANNEL_ID = process.env.SUPPORT_INVITE_CHANNEL_ID || '';

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
    .setName('wishlist')
    .setDescription('View your wishlist with current prices')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Get an invite link to add SkinVaults bot to your server')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get a permanent invite link to the SkinVaults community server')
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

  new SlashCommandBuilder()
    .setName('credits')
    .setDescription('View your credits balance')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily credits reward')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('spins')
    .setDescription('Daily spins: check status, claim, or roll')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Choose an action')
        .setRequired(true)
        .addChoices(
          { name: 'Status', value: 'status' },
          { name: 'Claim Daily Spins', value: 'claim' },
          { name: 'Roll Spin', value: 'roll' }
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('giveaways')
    .setDescription('List giveaways (active or past)')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Which giveaways to show')
        .setRequired(false)
        .addChoices(
          { name: 'Active', value: 'active' },
          { name: 'Past', value: 'past' },
          { name: 'All', value: 'all' }
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('giveaway-enter')
    .setDescription('Enter a giveaway using credits')
    .addStringOption(option =>
      option.setName('giveaway_id')
        .setDescription('Giveaway id (from /giveaways)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('entries')
        .setDescription('How many entries to buy')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100000)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from this Discord server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Delete messages from last N days (0-7)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from this Discord server.')
    .addStringOption(option =>
      option.setName('discord_id')
        .setDescription('Discord user id')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user in this Discord server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to timeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration of the timeout')
        .setRequired(true)
        .addChoices(
          { name: '1 Minute', value: '1min' },
          { name: '5 Minutes', value: '5min' },
          { name: '30 Minutes', value: '30min' },
          { name: '1 Hour', value: '60min' },
          { name: '1 Day', value: '1day' }
        )
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a user in this Discord server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to remove timeout from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('banadmin')
    .setDescription('ADMIN: Ban a user (Discord + website + credits)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban (if in server)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('discord_id')
        .setDescription('Discord user id (if not in server)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('steam_id')
        .setDescription('SteamID64 (if not linked)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Delete Discord messages from last N days (0-7)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .addIntegerOption(option =>
      option.setName('purge_website_days')
        .setDescription('Delete website chat messages from last N days (0-365)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(365)
    )
    .addBooleanOption(option =>
      option.setName('purge_website_dm')
        .setDescription('Also purge their website DMs (default false)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('unbanadmin')
    .setDescription('ADMIN: Unban a user (Discord + website + credits)')
    .addStringOption(option =>
      option.setName('discord_id')
        .setDescription('Discord user id (required)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('steam_id')
        .setDescription('SteamID64 (if not linked)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('timeoutadmin')
    .setDescription('ADMIN: Timeout a user (Discord + website + credits)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to timeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration of the timeout')
        .setRequired(true)
        .addChoices(
          { name: '1 Minute', value: '1min' },
          { name: '5 Minutes', value: '5min' },
          { name: '30 Minutes', value: '30min' },
          { name: '1 Hour', value: '60min' },
          { name: '1 Day', value: '1day' }
        )
    )
    .addStringOption(option =>
      option.setName('steam_id')
        .setDescription('SteamID64 (if not linked)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('untimeoutadmin')
    .setDescription('ADMIN: Remove timeout (Discord + website + credits)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to untimeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('steam_id')
        .setDescription('SteamID64 (if not linked)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .toJSON()
];

const TIMEOUT_DURATIONS = {
  '1min': 1 * 60 * 1000,
  '5min': 5 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '60min': 60 * 60 * 1000,
  '1day': 24 * 60 * 60 * 1000,
};

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    log(`Received command: /${commandName} by ${interaction.user.tag} (${interaction.user.id})`);

    if (commandName === 'ban') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!hasPerm(interaction, PermissionsBitField.Flags.BanMembers)) {
        await interaction.reply({ content: '❌ You do not have permission to ban members.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser('user');
      const deleteDays = interaction.options.getInteger('delete_days');
      const reason = interaction.options.getString('reason') || 'Moderation action';
      try {
        const seconds = Math.max(0, Math.min(7, Number.isFinite(deleteDays) ? deleteDays : 0)) * 24 * 60 * 60;
        await interaction.guild.bans.create(targetUser.id, { reason, deleteMessageSeconds: seconds });
        await interaction.editReply({ content: `🔨 **Ban Complete**\nDiscord: ✅ banned ${targetUser.tag} (${targetUser.id})` });
      } catch (e) {
        await interaction.editReply({ content: `❌ **Ban Failed**\nCould not ban user. Error: ${e.message}` });
      }
    } else if (commandName === 'unban') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!hasPerm(interaction, PermissionsBitField.Flags.BanMembers)) {
        await interaction.reply({ content: '❌ You do not have permission to unban members.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const discordId = interaction.options.getString('discord_id');
      const reason = interaction.options.getString('reason') || 'Moderation action';
      try {
        await interaction.guild.bans.remove(discordId, reason);
        await interaction.editReply({ content: `✅ **Unban Complete**\nDiscord: attempted unban userId ${discordId}` });
      } catch (e) {
        await interaction.editReply({ content: `❌ **Unban Failed**\nCould not unban user. Are you sure the ID is correct?` });
      }
    } else if (commandName === 'timeout') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!hasPerm(interaction, PermissionsBitField.Flags.ModerateMembers)) {
        await interaction.reply({ content: '❌ You do not have permission to timeout members.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser('user');
      const duration = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'Moderation action';
      const durationMs = TIMEOUT_DURATIONS[duration];
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await member.timeout(durationMs, reason);
        await interaction.editReply({ content: `🔨 **Timeout Complete**\nDiscord: ✅ timed out ${targetUser.tag} (${targetUser.id}) for ${duration}` });
      } catch (e) {
        await interaction.editReply({ content: `❌ **Timeout Failed**\nCould not timeout user. Error: ${e.message}` });
      }
    } else if (commandName === 'untimeout') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!hasPerm(interaction, PermissionsBitField.Flags.ModerateMembers)) {
        await interaction.reply({ content: '❌ You do not have permission to remove timeouts.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Moderation action';
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await member.timeout(null, reason);
        await interaction.editReply({ content: `✅ **Timeout Removed**\nDiscord: ✅ removed timeout from ${targetUser.tag} (${targetUser.id})` });
      } catch (e) {
        await interaction.editReply({ content: `❌ **Timeout Removal Failed**\nCould not remove timeout. Error: ${e.message}` });
      }
    } else if (commandName === 'banadmin') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser('user');
      const discordId = interaction.options.getString('discord_id') || (targetUser ? targetUser.id : '');
      const steamId = interaction.options.getString('steam_id') || '';
      const deleteDays = interaction.options.getInteger('delete_days');
      const purgeWebsiteDays = interaction.options.getInteger('purge_website_days');
      const purgeWebsiteDM = interaction.options.getBoolean('purge_website_dm');
      const reason = interaction.options.getString('reason') || 'Moderation action';

      if (!discordId && !steamId) {
        await interaction.editReply({ content: '❌ You must provide a `user`, `discord_id`, or `steam_id`.' });
        return;
      }

      let discordStatus = '⚪ Not attempted';
      if (discordId) {
        try {
          const seconds = Math.max(0, Math.min(7, Number.isFinite(deleteDays) ? deleteDays : 1)) * 24 * 60 * 60;
          await interaction.guild.bans.create(discordId, { reason, deleteMessageSeconds: seconds });
          discordStatus = `✅ Banned userId ${discordId}`;
        } catch (e) {
          discordStatus = `⚠️ Discord ban failed: ${e.message}`;
        }
      }

      const { res, json } = await fetchBotApi('/api/discord/bot/moderation', {
        method: 'POST',
        body: JSON.stringify({
          action: 'ban',
          discordId: discordId || undefined,
          steamId: steamId || undefined,
          reason,
          purgeDays: Number.isFinite(purgeWebsiteDays) ? purgeWebsiteDays : 0,
          purgeIncludeDM: !!purgeWebsiteDM,
          restrictCredits: true,
        }),
      });

      const websiteStatus = res.ok ? `✅ Website banned (${json?.steamId || 'linked'})` : `⚠️ Website ban failed: ${json?.error || 'not linked'}`;
      const purgeInfo = res.ok && json?.purge ? `\nPurged website chat: global ${json.purge.globalDeleted}, dm ${json.purge.dmDeleted}` : '';
      await interaction.editReply({ content: `🔨 **Admin Ban Complete**\nDiscord: ${discordStatus}\nWebsite: ${websiteStatus}${purgeInfo}` });

    } else if (commandName === 'unbanadmin') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const discordId = interaction.options.getString('discord_id');
      const steamId = interaction.options.getString('steam_id');
      const reason = interaction.options.getString('reason') || 'Moderation action';

      let discordStatus = '⚪ Not attempted';
      try {
        await interaction.guild.bans.remove(discordId, reason);
        discordStatus = `✅ Unbanned userId ${discordId}`;
      } catch (e) {
        discordStatus = `⚠️ Discord unban failed: ${e.message}`;
      }

      const { res, json } = await fetchBotApi('/api/discord/bot/moderation', {
        method: 'POST',
        body: JSON.stringify({ action: 'unban', discordId, steamId: steamId || undefined, reason, restrictCredits: true }),
      });

      const websiteStatus = res.ok ? `✅ Website unbanned (${json?.steamId || 'linked'})` : `⚠️ Website unban failed: ${json?.error || 'not linked'}`;
      await interaction.editReply({ content: `✅ **Admin Unban Complete**\nDiscord: ${discordStatus}\nWebsite: ${websiteStatus}` });

    } else if (commandName === 'timeoutadmin') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser('user');
      const steamId = interaction.options.getString('steam_id');
      const duration = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'Moderation action';
      const durationMs = TIMEOUT_DURATIONS[duration];

      let discordStatus = '⚪ Not attempted';
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await member.timeout(durationMs, reason);
        discordStatus = `✅ Timed out ${targetUser.tag} for ${duration}`;
      } catch (e) {
        discordStatus = `⚠️ Discord timeout failed: ${e.message}`;
      }

      const { res, json } = await fetchBotApi('/api/discord/bot/moderation', {
        method: 'POST',
        body: JSON.stringify({ action: 'timeout', discordId: targetUser.id, steamId: steamId || undefined, reason, duration, restrictCredits: true }),
      });

      const websiteStatus = res.ok ? `✅ Website timeout set (${json?.steamId || 'linked'})` : `⚠️ Website timeout failed: ${json?.error || 'not linked'}`;
      await interaction.editReply({ content: `🔨 **Admin Timeout Complete**\nDiscord: ${discordStatus}\nWebsite: ${websiteStatus}` });

    } else if (commandName === 'shop') {
      const embed = new EmbedBuilder()
        .setTitle('🛒 SkinVaults Shop')
        .setDescription('Click the link below to browse Pro subscriptions and other consumables.')
        .setColor(0x5865F2)
        .addFields({ name: 'Shop URL', value: `${API_BASE_URL}/shop` });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (commandName === 'guild') {
      const embed = new EmbedBuilder()
        .setTitle('🔗 Add SkinVaults to Your Server')
        .setDescription(`[Click here to invite the bot to your Discord server.](${getInviteUrl()})`)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (commandName === 'support') {
      if (!SUPPORT_INVITE_CHANNEL_ID) {
        await interaction.reply({ content: '❌ Support server invite is not configured.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle('🤝 SkinVaults Support')
        .setDescription(`[Click here to join the official SkinVaults community server.](https://discord.gg/${SUPPORT_INVITE_CHANNEL_ID})`)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('❓ SkinVaults Help')
        .setDescription('Here are some of the things I can do. For a full list, visit the website.')
        .setColor(0x5865F2)
        .addFields(
          { name: '/price <item>', value: 'Check the price of a CS2 skin.' },
          { name: '/inventory', value: 'View your inventory summary.' },
          { name: '/wishlist', value: 'See your wishlist items.' },
          { name: '/vault', value: 'Check your total vault value.' },
          { name: '/stats', value: 'View your CS2 player stats.' },
          { name: '/pro', value: 'Check your Pro subscription status.' },
          { name: '/shop', value: 'Browse the SkinVaults shop.' },
          { name: '/website', value: 'Get a link to the SkinVaults website.' },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (commandName === 'inventory') {
      await interaction.deferReply({ ephemeral: true });
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=inventory&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'wishlist') {
      await interaction.deferReply({ ephemeral: true });
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=wishlist&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'vault') {
      await interaction.deferReply({ ephemeral: true });
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=vault&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'stats') {
      await interaction.deferReply({ ephemeral: true });
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=stats&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'price') {
      await interaction.deferReply({ ephemeral: true });
      const item = interaction.options.getString('item');
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=price&item=${encodeURIComponent(item)}&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data.'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'player') {
      await interaction.deferReply({ ephemeral: true });
      const query = interaction.options.getString('query');
      const platform = interaction.options.getString('platform');
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=player&query=${encodeURIComponent(query)}&platform=${platform}&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data.'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'credits') {
      await interaction.deferReply({ ephemeral: true });
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=credits&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'daily') {
      await interaction.deferReply({ ephemeral: true });
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=daily&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'spins') {
      await interaction.deferReply({ ephemeral: true });
      const action = interaction.options.getString('action');
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=spins&action=${action}&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'giveaways') {
      await interaction.deferReply({ ephemeral: true });
      const status = interaction.options.getString('status') || 'active';
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=giveaways&status=${status}&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data.'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'giveaway-enter') {
      await interaction.deferReply({ ephemeral: true });
      const giveawayId = interaction.options.getString('giveaway_id');
      const entries = interaction.options.getInteger('entries');
      const { res, json } = await fetchBotApi('/api/discord/bot/giveaway-enter', {
        method: 'POST',
        body: JSON.stringify({
          discordId: interaction.user.id,
          giveawayId,
          entries,
        }),
      });
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not enter giveaway.'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'currency') {
      await interaction.deferReply({ ephemeral: true });
      const currency = interaction.options.getString('currency');
      const { res, json } = await fetchBotApi('/api/discord/bot/set-currency', {
        method: 'POST',
        body: JSON.stringify({
          discordId: interaction.user.id,
          currency: currency,
        }),
      });
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not set currency.'}` });
        return;
      }
      await interaction.editReply({ content: `✅ Your preferred currency has been updated.` });
    } else if (commandName === 'compare') {
      await interaction.deferReply({ ephemeral: true });
      const item1 = interaction.options.getString('item1');
      const item2 = interaction.options.getString('item2');
      const item3 = interaction.options.getString('item3');
      let url = `/api/discord/bot/simple-embed?command=compare&item1=${encodeURIComponent(item1)}&item2=${encodeURIComponent(item2)}&discordId=${interaction.user.id}`;
      if (item3) {
        url += `&item3=${encodeURIComponent(item3)}`;
      }
      const { res, json } = await fetchBotApi(url);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data.'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'alerts') {
      await interaction.deferReply({ ephemeral: true });
      const { res, json } = await fetchBotApi(`/api/discord/bot/simple-embed?command=alerts&discordId=${interaction.user.id}`);
      if (!res.ok) {
        await interaction.editReply({ content: `❌ Error: ${json?.error || 'Could not fetch data. Is your account linked?'}` });
        return;
      }
      const embed = new EmbedBuilder(json);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'website') {
      const embed = new EmbedBuilder()
        .setTitle('🌐 SkinVaults Website')
        .setDescription(`[Click here to visit SkinVaults.](${API_BASE_URL})`)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (commandName === 'pro') {
      const embed = new EmbedBuilder()
        .setTitle('👑 SkinVaults Pro')
        .setDescription('Click the link below to view your Pro status and manage your subscription.')
        .setColor(0x5865F2)
        .addFields({ name: 'Pro URL', value: `${API_BASE_URL}/pro` });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (commandName === 'untimeoutadmin') {
      const g = requireGuildInteraction(interaction);
      if (!g.ok) {
        await interaction.reply({ content: `❌ ${g.error}`, ephemeral: true });
        return;
      }
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser('user');
      const steamId = interaction.options.getString('steam_id');
      const reason = interaction.options.getString('reason') || 'Moderation action';

      let discordStatus = '⚪ Not attempted';
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await member.timeout(null, reason);
        discordStatus = `✅ Removed timeout from ${targetUser.tag}`;
      } catch (e) {
        discordStatus = `⚠️ Discord untimeout failed: ${e.message}`;
      }

      const { res, json } = await fetchBotApi('/api/discord/bot/moderation', {
        method: 'POST',
        body: JSON.stringify({ action: 'untimeout', discordId: targetUser.id, steamId: steamId || undefined, reason, restrictCredits: true }),
      });

      const websiteStatus = res.ok ? `✅ Website timeout removed (${json?.steamId || 'linked'})` : `⚠️ Website timeout failed: ${json?.error || 'not linked'}`;
      await interaction.editReply({ content: `✅ **Admin Timeout Removal Complete**\nDiscord: ${discordStatus}\nWebsite: ${websiteStatus}` });
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

