"use client";

import React from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
                <Shield className="text-blue-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                  Privacy Policy
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
                1. Introduction
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVaults ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                2. Information We Collect
              </h2>
              
              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                2.1 Information from Steam
              </h3>
              <p className="text-gray-300 mb-4">
                When you authenticate through Steam, we collect:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Steam ID (SteamID64)</li>
                <li>Steam profile name</li>
                <li>Steam avatar image</li>
                <li>Public inventory data (skins, items)</li>
                <li>Public game statistics (if profile is public)</li>
                <li>Faceit player data (when available) - ELO, level, nickname, player ID</li>
                <li>Faceit CS2 statistics (when available) - K/D ratio, win rate, headshot percentage, KAST, matches, kills, deaths, assists, MVPs, and other performance metrics</li>
              </ul>
              <p className="text-gray-300 mt-4">
                <strong>Note:</strong> We only access publicly available information from your Steam profile. We do not access private inventory or profile data.
              </p>

              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                2.2 Information from Discord (Optional)
              </h3>
              <p className="text-gray-300 mb-4">
                When you connect your Discord account (optional), we collect:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Discord ID (unique identifier)</li>
                <li>Discord username (including discriminator if applicable)</li>
                <li>Discord avatar image</li>
                <li>Discord OAuth access token and refresh token (for sending direct messages)</li>
                <li>Token expiration timestamp</li>
                <li>Connection timestamp</li>
              </ul>
              <p className="text-gray-300 mt-4">
                <strong>Note:</strong> Discord tokens are stored securely and expire automatically. You can disconnect your Discord account at any time, which will remove all stored Discord data and active price trackers.
              </p>

              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                2.3 Information You Provide
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Wishlist items (stored locally in your browser and optionally synced to server)</li>
                <li>Currency preferences (Steam-supported currencies, stored in browser localStorage)</li>
                <li>Price alert/tracker settings (target prices, conditions)</li>
                <li>Contact form submissions (name, email, message, images)</li>
                <li>Payment information (processed securely through Stripe - we do not store credit card details)</li>
                <li>Compare list items (stored locally in browser, max 2 items)</li>
                <li>Purchase history (Pro subscriptions and consumable purchases)</li>
                <li>Consumable purchases (wishlist slots, Discord access, price scan boost, cache boost - stored in user_rewards database key)</li>
                <li>Chat messages (global chat messages and direct messages)</li>
                <li>DM conversations (direct message threads between users)</li>
                <li>DM invites (invitations to start direct message conversations)</li>
                <li>Chat reports (reported messages with admin notes)</li>
                <li>Admin actions (timeouts, bans, message deletions, pins)</li>
              </ul>

              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                2.4 Automatically Collected Information
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>First login timestamp (for new user bonus eligibility, stored in Vercel KV and MongoDB)</li>
                <li>Pro subscription status and expiration dates (stored in Vercel KV and MongoDB)</li>
                <li>Claimed bonus status (stored in Vercel KV and MongoDB)</li>
                <li>Price alert trigger history (stored in Vercel KV and MongoDB)</li>
                <li>Purchase history (all Pro and consumable purchases, including session IDs, amounts, timestamps, fulfillment status - stored in Vercel KV and MongoDB)</li>
                <li>Failed purchase records (for admin review and manual fulfillment - stored in Vercel KV and MongoDB)</li>
                <li>User rewards (consumable purchases like wishlist slots, Discord access, boosts - stored in Vercel KV and MongoDB)</li>
                <li>Banned user list (Steam IDs that are banned from the Service - stored in Vercel KV and MongoDB)</li>
                <li>Stripe test mode status (for payment testing - stored in Vercel KV and MongoDB)</li>
                <li>Chat notification preferences (unread message counts, last check timestamps - stored in browser localStorage)</li>
                <li>Browser type and device information</li>
                <li>IP address (for security and analytics)</li>
                <li>Usage data (pages visited, features used, commands executed, chat activity)</li>
                <li>Price cache data (stored locally in browser for performance - Free: 30 min, Pro: 2 hours, Cache Boost: 1 hour)</li>
                <li>Dataset cache (item information from CS:GO API, stored locally in browser for 12-24 hours)</li>
                <li>Chat message cache (recent messages cached locally for faster loading - stored in browser localStorage)</li>
                <li>DM list cache (list of direct message conversations - stored in browser localStorage)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                3. How We Use Your Information
              </h2>
              <p className="text-gray-300 mb-4">
                We use the collected information for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Providing and maintaining the Service</li>
                <li>Displaying your inventory and statistics (Steam and Faceit)</li>
                <li>Processing Pro subscription payments</li>
                <li>Managing your account and preferences</li>
                <li>Enabling community chat and direct messaging</li>
                <li>Sending service-related communications</li>
                <li>Responding to your contact form submissions</li>
                <li>Moderating chat content and enforcing community guidelines</li>
                <li>Improving and optimizing the Service</li>
                <li>Detecting and preventing fraud or abuse</li>
                <li>Complying with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                4. Data Storage and Security
              </h2>
              
              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                4.1 Storage Locations
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Browser LocalStorage:</strong> 
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li>Wishlist items (key: <code>sv_wishlist_v1</code>)</li>
                    <li>Currency preferences (key: <code>sv_currency</code>)</li>
                    <li>User session data (key: <code>steam_user</code>)</li>
                    <li>Price cache (key: <code>sv_price_cache_v1</code>)</li>
                    <li>Dataset cache (key: <code>sv_dataset_cache_v1</code>)</li>
                    <li>Compare list (key: <code>sv_compare_list</code>)</li>
                    <li>Chat message cache (key: <code>sv_chat_cache</code>)</li>
                    <li>DM list (key: <code>sv_dm_list</code>)</li>
                    <li>Chat notification data (key: <code>sv_chat_notifications</code>) - unread counts, last check times</li>
                  </ul>
                </li>
                <li><strong>MongoDB Database:</strong> 
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li>Pro subscription data (key: <code>pro_users</code>)</li>
                    <li>First login timestamps (key: <code>first_logins</code>)</li>
                    <li>Claimed bonus flags (key: <code>claimed_free_month</code>)</li>
                    <li>Discord connections (key: <code>discord_connections</code>) - includes Discord ID, username, avatar, OAuth tokens</li>
                    <li>Price alerts/trackers (key: <code>price_alerts</code>) - includes target prices, conditions, trigger status</li>
                    <li>Discord DM queue (key: <code>discord_dm_queue</code>) - temporary queue for bot messages</li>
                    <li>Purchase history (key: <code>purchase_history</code>) - all Pro and consumable purchases with session IDs, amounts, timestamps, fulfillment status</li>
                    <li>Failed purchases (key: <code>failed_purchases</code>) - purchases that failed to fulfill automatically, for admin review</li>
                    <li>User rewards (key: <code>user_rewards</code>) - consumable purchases (wishlist slots, Discord access, boosts) with grant timestamps and session IDs</li>
                    <li>Banned Steam IDs (key: <code>banned_steam_ids</code>) - list of banned users</li>
                    <li>Stripe test mode status (key: <code>stripe_test_mode</code>) - toggle for payment testing</li>
                    <li>Global chat messages (key: <code>global_chat</code>) - all public chat messages</li>
                    <li>Direct messages (key: <code>dm_messages</code>) - private messages between users</li>
                    <li>DM conversations (key: <code>dm_conversations</code>) - DM thread metadata</li>
                    <li>DM invites (key: <code>dm_invites</code>) - pending DM invitations</li>
                    <li>Chat reports (key: <code>chat_reports</code>) - reported messages with admin notes</li>
                    <li>Chat timeouts (key: <code>chat_timeouts</code>) - temporary chat bans</li>
                  </ul>
                </li>
                <li><strong>Stripe:</strong> Payment information (we do not store credit card details on our servers). Supports both production and test mode for payment testing.</li>
              </ul>

              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                4.2 Security Measures
              </h3>
              <p className="text-gray-300 mb-4">
                We implement appropriate technical and organizational measures to protect your data:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>HTTPS encryption for all data transmission</li>
                <li>Secure authentication through Steam OpenID</li>
                <li>Encrypted database storage (Vercel KV)</li>
                <li>Regular security updates and monitoring</li>
                <li>Access controls and authentication for admin functions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                5. Data Sharing and Disclosure
              </h2>
              <p className="text-gray-300 mb-4">
                We do not sell your personal information. We may share data with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Steam:</strong> For authentication and accessing your public profile data, inventory, and statistics</li>
                <li><strong>Faceit:</strong> For fetching player statistics, ELO, and CS2 performance data (subject to Faceit's privacy policy)</li>
                <li><strong>Discord:</strong> For sending price alert notifications via direct messages and enabling bot commands (subject to Discord's privacy policy)</li>
                <li><strong>Pusher:</strong> For real-time chat updates via WebSocket connections (subject to Pusher's privacy policy)</li>
                <li><strong>Stripe:</strong> For payment processing (subject to Stripe's privacy policy)</li>
                <li><strong>Vercel:</strong> For hosting and data storage via Vercel KV (subject to Vercel's privacy policy)</li>
                <li><strong>MongoDB:</strong> For database backup and fallback storage via MongoDB Atlas (subject to MongoDB's privacy policy)</li>
                <li><strong>Email Service Providers:</strong> For sending contact form emails (Resend, SMTP providers)</li>
                <li><strong>Proxy Services:</strong> ScraperAPI, ZenRows, ScrapingAnt for accessing Steam Community Market data</li>
                <li><strong>steamid.io:</strong> For resolving Steam usernames to Steam64 IDs</li>
                <li><strong>CORS Proxy Services:</strong> corsproxy.io, api.allorigins.win for accessing external APIs</li>
              </ul>
              <p className="text-gray-300 mt-4">
                We may also disclose information if required by law or to protect our rights and safety.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                6. Cookies and Local Storage
              </h2>
              <p className="text-gray-300 mb-4">
                We use browser localStorage (not cookies) to store:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Your Steam authentication session (Steam ID, profile name, avatar)</li>
                <li>Wishlist items (optionally synced to server for cross-device access)</li>
                <li>Currency preferences (Steam-supported currencies)</li>
                <li>Price cache data (cached market prices for performance - Free: 30 min, Pro: 2 hours)</li>
                <li>Dataset cache (item information from CS:GO API - cached for 12-24 hours)</li>
                <li>Compare list (items selected for comparison, max 2 items)</li>
                <li>Chat message cache (recent messages for faster loading)</li>
                <li>DM list (list of direct message conversations)</li>
                <li>Chat notification data (unread message counts, last check timestamps)</li>
              </ul>
              <p className="text-gray-300 mt-4">
                This data is stored locally in your browser and is not transmitted to our servers except when necessary for the Service to function (e.g., wishlist sync, price alerts). You can clear this data at any time by clearing your browser's localStorage.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                7. Third-Party Services
              </h2>
              <p className="text-gray-300 mb-4">
                Our Service integrates with third-party services that have their own privacy policies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Steam:</strong> <a href="https://store.steampowered.com/privacy_agreement/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Steam Privacy Policy</a></li>
                <li><strong>Faceit:</strong> <a href="https://www.faceit.com/en/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Faceit Terms of Service</a></li>
                <li><strong>Discord:</strong> <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Discord Privacy Policy</a></li>
                <li><strong>Pusher:</strong> <a href="https://pusher.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Pusher Privacy Policy</a></li>
                <li><strong>Stripe:</strong> <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Stripe Privacy Policy</a></li>
                <li><strong>Vercel:</strong> <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Vercel Privacy Policy</a></li>
                <li><strong>MongoDB:</strong> <a href="https://www.mongodb.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">MongoDB Privacy Policy</a></li>
                <li><strong>Proxy Services:</strong> ScraperAPI, ZenRows, ScrapingAnt (each has their own privacy policies)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                8. Your Rights and Choices
              </h2>
              <p className="text-gray-300 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Access:</strong> Request information about data we hold about you</li>
                <li><strong>Correction:</strong> Update or correct your information</li>
                <li><strong>Deletion:</strong> Request deletion of your data (subject to legal requirements)</li>
                <li><strong>Withdrawal:</strong> Withdraw consent for data processing</li>
                <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
              </ul>
              <p className="text-gray-300 mt-4">
                To exercise these rights, contact us through our <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact Page</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                9. Data Retention
              </h2>
              <p className="text-gray-300 mb-4">
                We retain your data for as long as necessary to provide the Service:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Account Data:</strong> Retained while your account is active</li>
                <li><strong>Pro Subscription Data:</strong> Retained for the duration of your subscription and for legal/accounting purposes</li>
                <li><strong>Purchase History:</strong> Retained for legal/accounting purposes and customer support. Includes Pro subscriptions and consumable purchases.</li>
                <li><strong>User Rewards (Consumables):</strong> Retained permanently as consumables never expire. Includes wishlist slots, Discord access, and boost purchases.</li>
                <li><strong>Discord Connection Data:</strong> Retained until you disconnect your Discord account or tokens expire. Expired tokens are automatically removed.</li>
                <li><strong>Price Alert Data:</strong> Retained until you delete the alert or disconnect your Discord account</li>
                <li><strong>Contact Form Data:</strong> Retained for customer support purposes</li>
                <li><strong>Banned User Data:</strong> Retained until the ban is lifted. If you are unbanned, your access is restored immediately.</li>
                <li><strong>Chat Messages:</strong> Retained for moderation and legal purposes. Global chat messages are visible to all users. Direct messages are private between participants.</li>
                <li><strong>DM Conversations:</strong> Retained until both participants delete the conversation or one participant is banned</li>
                <li><strong>DM Invites:</strong> Retained until accepted, declined, or expired</li>
                <li><strong>Chat Reports:</strong> Retained for moderation purposes and may be kept for legal compliance</li>
                <li><strong>Admin Actions:</strong> Retained for audit and moderation purposes</li>
                <li><strong>Faceit Data:</strong> Not stored permanently - fetched on-demand and cached temporarily for performance</li>
                <li><strong>LocalStorage Data:</strong> Stored in your browser until you clear it. Wishlist data may be synced to server for cross-device access. Chat cache and DM list are stored locally for faster loading.</li>
                <li><strong>Discord DM Queue:</strong> Temporary queue cleared after messages are sent by the bot</li>
                <li><strong>Failed Purchase Records:</strong> Retained for admin review and manual fulfillment. May be cleared after successful fulfillment.</li>
              </ul>
              <p className="text-gray-300 mt-4">
                You can delete your local data at any time by clearing your browser's localStorage. You can disconnect your Discord account at any time, which will remove all Discord-related data and price trackers. To request deletion of server-stored data, contact us through our <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact Page</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                10. Children's Privacy
              </h2>
              <p className="text-gray-300 mb-4">
                Our Service is not intended for users under the age of 13. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                11. International Data Transfers
              </h2>
              <p className="text-gray-300 mb-4">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using the Service, you consent to the transfer of your information to these countries.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                12. Changes to This Privacy Policy
              </h2>
              <p className="text-gray-300 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                13. Contact Us
              </h2>
              <p className="text-gray-300 mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us through our <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact Page</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                14. GDPR Compliance (EU Users)
              </h2>
              <p className="text-gray-300 mb-4">
                If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Right to be informed about data collection</li>
                <li>Right of access to your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure ("right to be forgotten")</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Rights related to automated decision-making</li>
              </ul>
              <p className="text-gray-300 mt-4">
                To exercise these rights, contact us through our <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact Page</a>.
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}