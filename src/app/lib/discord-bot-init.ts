// Initialize Discord bot when Next.js app starts
// This runs on server startup

import { initializeDiscordBot } from '@/app/services/discord-bot';

let botInitialized = false;

export function initDiscordBot() {
  if (botInitialized) return;
  
  // Only initialize in production or when DISCORD_BOT_TOKEN is set
  if (process.env.DISCORD_BOT_TOKEN) {
    initializeDiscordBot().catch(console.error);
    botInitialized = true;
  }
}

// Auto-initialize on import (for server-side)
if (typeof window === 'undefined') {
  initDiscordBot();
}

