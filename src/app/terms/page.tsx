"use client";

import React from 'react';
import Sidebar from '@/app/components/Sidebar';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
                <FileText className="text-blue-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                  Terms of Service
                </h1>
                <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </header>

          <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8 text-[11px] md:text-[12px] leading-relaxed">
            
            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-300 mb-4">
                By accessing and using SkinVaults ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                2. Description of Service
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVaults is a CS2 (Counter-Strike 2) skin inventory tracking and analytics platform that provides:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Real-time inventory value tracking and portfolio management</li>
                <li>Skin price monitoring and analytics with market data</li>
                <li>Wishlist functionality (Free: 10 items, Pro: unlimited)</li>
                <li>Price alerts and trackers via Discord integration (Pro only: unlimited trackers)</li>
                <li>Player statistics and portfolio analytics (CS2 game stats from Steam)</li>
                <li>Faceit statistics integration (ELO, level, K/D ratio, win rate, headshot percentage, KAST, and advanced stats for Pro users)</li>
                <li>Skin comparison tool (compare up to 2 items side by side)</li>
                <li>Player search functionality (by Steam64 ID, Steam username, Discord username, or Discord ID)</li>
                <li>Community chat system with global chat, direct messages (DMs), and DM invites</li>
                <li>Pro subscription features (unlimited wishlist, unlimited price trackers, advanced stats, faster performance, priority API requests)</li>
                <li>Discord bot with comprehensive commands (/wishlist, /alerts, /inventory, /price, /vault, /stats, /player, /compare, /help)</li>
                <li>Fuzzy search for items and players</li>
                <li>Shareable inventory links</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                3. User Accounts and Steam Authentication
              </h2>
              <p className="text-gray-300 mb-4">
                To use certain features of the Service, you must authenticate through Steam using OpenID. By authenticating:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>You grant us permission to access your public Steam profile information</li>
                <li>You authorize us to display your Steam inventory data</li>
                <li>You understand that we only access publicly available information</li>
                <li>You are responsible for maintaining the security of your Steam account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                4. Faceit Statistics Integration
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVaults integrates with Faceit to display player statistics:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Faceit statistics are displayed on user inventory pages when available</li>
                <li>Basic stats (ELO, level, K/D ratio, win rate, headshot percentage, KAST) are available to all users</li>
                <li>Advanced stats (matches, wins, losses, total kills/deaths/assists, headshots, MVPs, averages, multi-kills) are available to Pro users only</li>
                <li>Statistics are fetched from the Faceit API using your Steam ID or Faceit nickname</li>
                <li>If a player is not found on Faceit, no statistics will be displayed (this is normal and not an error)</li>
                <li>Faceit data is cached for performance and may not reflect real-time values</li>
                <li>We use the Faceit Open API and may use an API key for higher rate limits</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                5. Community Chat System
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVaults provides a community chat system with the following features:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Global Chat:</strong> Public chat room where all users can communicate</li>
                <li><strong>Direct Messages (DMs):</strong> Private one-on-one messaging between users</li>
                <li><strong>DM Invites:</strong> Users can send and accept invitations to start direct message conversations</li>
                <li><strong>Message Features:</strong>
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li>Edit messages (within a time limit)</li>
                    <li>Pin messages (admin/owner only for global chat, both users for DMs)</li>
                    <li>Delete messages (admin/owner only for global chat, both users for DMs)</li>
                    <li>Report messages (flag inappropriate content)</li>
                    <li>Real-time updates via Pusher WebSocket connection</li>
                  </ul>
                </li>
                <li><strong>Admin Features:</strong>
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li>Timeout users (temporary ban from chat)</li>
                    <li>Ban users (permanent ban from chat)</li>
                    <li>Delete any message</li>
                    <li>Pin/unpin messages</li>
                    <li>View and manage reports</li>
                    <li>Manage admin notes on reports</li>
                  </ul>
                </li>
                <li><strong>User Responsibilities:</strong>
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li>Do not spam, harass, or abuse other users</li>
                    <li>Do not share inappropriate content</li>
                    <li>Respect other users' privacy</li>
                    <li>Follow community guidelines</li>
                  </ul>
                </li>
                <li><strong>Moderation:</strong> We reserve the right to timeout, ban, or remove users who violate our Terms of Service or community guidelines</li>
                <li><strong>Data Storage:</strong> Chat messages are stored in our database (Vercel KV and MongoDB) and may be retained for moderation and legal purposes</li>
                <li><strong>Privacy:</strong> Global chat messages are visible to all users. Direct messages are private between the two participants only</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                6. Discord Integration and Bot Commands
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVaults offers optional Discord integration with a comprehensive bot:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>You may connect your Discord account to receive price alert notifications and use bot commands</li>
                <li>Price trackers require a Pro subscription; Pro users have unlimited trackers</li>
                <li>Price alerts are sent via Discord direct messages when target prices are reached</li>
                <li>You can disconnect your Discord account at any time, which will remove all active price trackers</li>
                <li><strong>Discord Bot Commands Available:</strong>
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li><code>/wishlist</code> - View your wishlist with current prices</li>
                    <li><code>/alerts</code> - View your active price alerts</li>
                    <li><code>/inventory</code> - View your inventory summary and item list</li>
                    <li><code>/price &lt;item&gt;</code> - Check the current price of a CS2 skin (with fuzzy search)</li>
                    <li><code>/vault</code> - View your total vault value, statistics, top items, and weapon stats</li>
                    <li><code>/stats</code> - View your CS2 player statistics (basic stats for all, advanced stats for Pro users)</li>
                    <li><code>/player &lt;query&gt; platform:&lt;platform&gt;</code> - Search for a player by Steam64 ID, Steam username, Discord username, or Discord ID</li>
                    <li><code>/compare &lt;item1&gt; &lt;item2&gt; [item3]</code> - Compare up to 3 CS2 skins side by side</li>
                    <li><code>/help</code> - Get help with all available commands</li>
                  </ul>
                </li>
                <li>We store your Discord ID, username, avatar, and OAuth tokens (access token, refresh token) for the purpose of sending alerts and enabling bot commands</li>
                <li>Discord OAuth tokens expire and may require re-authentication</li>
                <li>Discord connection status is publicly visible on your profile</li>
                <li>The bot can search for players using Steam usernames, Steam64 IDs, Discord usernames, or Discord IDs</li>
                <li>Bot commands work in both Discord servers and direct messages (DMs)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                7. Pro Subscription and Consumables
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVaults offers a Pro subscription service and consumable items with the following terms:
              </p>
              
              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                5.1 Pro Subscription
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Pricing:</strong> €9.99/month, €24.99/3 months (save €5), €44.99/6 months (save €15)</li>
                <li><strong>Payment:</strong> Processed securely through Stripe. All payments are final unless otherwise stated. We do not store credit card details on our servers.</li>
                <li><strong>Free Trial:</strong> New users may be eligible for a 1-month free trial within 7 days of first login. This offer is one-time only and must be claimed manually. The offer expires after 7 days if not claimed.</li>
                <li><strong>Auto-Renewal:</strong> Subscriptions do not auto-renew. You must manually renew your subscription before expiration.</li>
                <li><strong>Refunds:</strong> Refund requests are handled on a case-by-case basis. Contact support for assistance.</li>
                <li><strong>Cancellation:</strong> You may cancel your subscription at any time. Access continues until the end of your paid period.</li>
                <li><strong>Pro Features Include:</strong>
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li>Unlimited wishlist items (Free: 10 items max, can purchase additional slots)</li>
                    <li>Unlimited price trackers (Pro only - free users can purchase Discord Access for 3 trackers)</li>
                    <li>Advanced player statistics (ADR, MVPs, Accuracy, Rounds Played, Total Damage)</li>
                    <li>Faster price scanning (10x speed with higher concurrency - Free: 3 concurrent, Pro: 10 concurrent)</li>
                    <li>Priority API requests</li>
                    <li>Better caching (2x longer cache duration - Free: 30 min, Pro: 2 hours)</li>
                    <li>Fast wishlist updates (larger batch processing)</li>
                    <li>Advanced compare stats & value breakdown</li>
                    <li>Early access to new tools and features</li>
                    <li>Price alerts via Discord</li>
                  </ul>
                </li>
              </ul>

              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                5.2 Consumables (One-Time Purchases)
              </h3>
              <p className="text-gray-300 mb-4">
                SkinVaults offers consumable items that enhance your free account. These are one-time purchases that never expire:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Wishlist Slots (€1.99 per slot):</strong> Add one additional item to your wishlist. Each purchase adds +1 to your wishlist limit. Pro users already have unlimited wishlist items.</li>
                <li><strong>Discord Access (€4.99):</strong> Get Discord bot access and create up to 3 price trackers. Receive price alerts directly in Discord for your favorite items. This is for free users only - Pro users already have unlimited trackers. Permanent access that never expires.</li>
                <li><strong>Price Scan Boost (€2.49):</strong> Increase concurrent price scans from 3 to 5. Scan prices faster for your inventory and wishlist. Permanent upgrade. Pro users already have 10 concurrent scans.</li>
                <li><strong>Price Cache Boost (€1.99):</strong> Extend price cache duration from 30 minutes to 1 hour. Prices update less frequently, saving API requests. Permanent upgrade. Pro users already have 2-hour cache.</li>
              </ul>
              <p className="text-gray-300 mt-4">
                <strong>Note:</strong> Consumables are permanent and never expire. Pro users already have access to all consumable benefits, so they do not need to purchase consumables. All consumable purchases are processed securely through Stripe. We do not store credit card details on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                8. User Responsibilities
              </h2>
              <p className="text-gray-300 mb-4">
                You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Use the Service only for lawful purposes</li>
                <li>Not attempt to gain unauthorized access to the Service</li>
                <li>Not use the Service to violate any laws or regulations</li>
                <li>Not abuse, harass, or harm other users</li>
                <li>Provide accurate information when using the Service</li>
                <li>Maintain the confidentiality of your account credentials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                9. Account Termination and Bans
              </h2>
              <p className="text-gray-300 mb-4">
                We reserve the right to ban or terminate accounts that violate our Terms of Service:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Banned users will be immediately logged out and redirected to the contact page</li>
                <li>Banned users cannot access the Service or create new accounts using the same Steam ID</li>
                <li>Ban decisions are final, but you may contact support to appeal</li>
                <li>If you are unbanned, your account access will be restored immediately</li>
                <li>We may ban accounts for: violation of terms, fraudulent activity, abuse of the Service, or any other reason we deem necessary</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                10. Data and Content
              </h2>
              <p className="text-gray-300 mb-4">
                The Service displays data from:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Steam Community Market (price data via proxy services)</li>
                <li>Steam Web API (inventory, profile data, and player statistics)</li>
                <li>Steam Community profiles (profile information, avatars)</li>
                <li>Faceit Open API (player statistics, ELO, match data)</li>
                <li>steamid.io (for Steam username resolution)</li>
                <li>CS:GO API dataset (item information, images, rarity data)</li>
                <li>Your local browser storage (wishlist, preferences, price cache, compare list)</li>
                <li>Vercel KV database (primary) and MongoDB (backup/fallback) - Pro subscriptions, Discord connections, price alerts, purchase history, user rewards, banned users, chat messages, DM conversations, DM invites, reports, admin actions</li>
                <li>Pusher (real-time chat updates via WebSocket)</li>
              </ul>
              <p className="text-gray-300 mt-4">
                We do not guarantee the accuracy, completeness, or timeliness of price data. Market prices are subject to change and may not reflect real-time values. Price data is cached for performance optimization (Free: 30 minutes, Pro: 2 hours, or 1 hour with Cache Boost consumable).
              </p>
              <p className="text-gray-300 mt-4">
                <strong>Database System:</strong> We use a dual-database system for reliability:
                <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                  <li><strong>Vercel KV (Primary):</strong> Fast, serverless Redis database for real-time data</li>
                  <li><strong>MongoDB (Backup/Fallback):</strong> Persistent database that automatically backs up all data and serves as fallback when KV is unavailable or hits rate limits</li>
                  <li>Both databases are kept in sync automatically. If KV fails, the system seamlessly switches to MongoDB. When KV recovers, data syncs back from MongoDB.</li>
                </ul>
              </p>
              <p className="text-gray-300 mt-4">
                <strong>Proxy Services:</strong> We use multiple proxy services (ScraperAPI, ZenRows, ScrapingAnt, and fallback proxies) to access Steam Community Market data. These services help bypass rate limits and improve reliability. Pro users get direct Steam API access with priority requests, falling back to proxies only if needed.
              </p>
              <p className="text-gray-300 mt-4">
                <strong>Faceit API:</strong> We use the Faceit Open API to fetch player statistics. An optional API key may be used for higher rate limits. Faceit data is cached for performance and may not reflect real-time values.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                11. Intellectual Property
              </h2>
              <p className="text-gray-300 mb-4">
                All content, features, and functionality of the Service are owned by SkinVaults and are protected by international copyright, trademark, and other intellectual property laws. You may not:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Copy, modify, or create derivative works</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Use our trademarks or logos without permission</li>
                <li>Scrape or harvest data from the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                12. Limitation of Liability
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVaults is provided "as is" without warranties of any kind. We are not liable for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Any loss or damage resulting from use of the Service</li>
                <li>Inaccurate price data or market information</li>
                <li>Service interruptions or technical issues</li>
                <li>Decisions made based on information provided by the Service</li>
                <li>Loss of data or account access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                13. Third-Party Services
              </h2>
              <p className="text-gray-300 mb-4">
                The Service integrates with third-party services that have their own privacy policies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Steam:</strong> For authentication, inventory data, player statistics, and profile information</li>
                <li><strong>Faceit:</strong> For player statistics, ELO, match data, and CS2 performance metrics</li>
                <li><strong>Discord:</strong> For price alert notifications, bot commands, and OAuth authentication</li>
                <li><strong>Pusher:</strong> For real-time chat updates via WebSocket connections</li>
                <li><strong>Stripe:</strong> For secure payment processing (we do not store credit card details). Supports both production and test mode for payment testing.</li>
                <li><strong>Vercel:</strong> For hosting, data storage (Vercel KV), and infrastructure</li>
                <li><strong>MongoDB:</strong> For database backup and fallback storage (MongoDB Atlas)</li>
                <li><strong>Proxy Services:</strong> ScraperAPI, ZenRows, ScrapingAnt, and other proxy services for accessing Steam Community Market data</li>
                <li><strong>steamid.io:</strong> For resolving Steam usernames to Steam64 IDs</li>
                <li><strong>CORS Proxy Services:</strong> corsproxy.io, api.allorigins.win for accessing external APIs</li>
                <li><strong>Email Services:</strong> Resend, SMTP providers for contact form submissions</li>
              </ul>
              <p className="text-gray-300 mt-4">
                Your use of these third-party services is subject to their respective terms and privacy policies. We are not responsible for the privacy practices or content of these third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                14. Changes to Terms
              </h2>
              <p className="text-gray-300 mb-4">
                We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or through the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                15. Contact Information
              </h2>
              <p className="text-gray-300 mb-4">
                For questions about these Terms of Service, please contact us through our <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact Page</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                16. Governing Law
              </h2>
              <p className="text-gray-300 mb-4">
                These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from these terms or use of the Service shall be resolved through appropriate legal channels.
              </p>
            </section>

          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
