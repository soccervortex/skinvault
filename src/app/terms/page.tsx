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
                By accessing and using SkinVault ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                2. Description of Service
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVault is a CS2 (Counter-Strike 2) skin inventory tracking and analytics platform that provides:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Real-time inventory value tracking and portfolio management</li>
                <li>Skin price monitoring and analytics with market data</li>
                <li>Wishlist functionality (Free: 10 items, Pro: unlimited)</li>
                <li>Price alerts and trackers via Discord integration (Free: 5 trackers, Pro: unlimited)</li>
                <li>Player statistics and portfolio analytics (CS2 game stats)</li>
                <li>Skin comparison tool (compare up to 3 items side by side)</li>
                <li>Player search functionality (by Steam64 ID, Steam username, Discord username, or Discord ID)</li>
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
                4. Discord Integration and Bot Commands
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVault offers optional Discord integration with a comprehensive bot:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>You may connect your Discord account to receive price alert notifications and use bot commands</li>
                <li>Free users can create up to 5 price trackers; Pro users have unlimited trackers</li>
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
                5. Pro Subscription
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVault offers a Pro subscription service with the following terms:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Pricing:</strong> €9.99/month, €24.99/3 months (save €5), €44.99/6 months (save €15)</li>
                <li><strong>Payment:</strong> Processed securely through Stripe. All payments are final unless otherwise stated. We do not store credit card details on our servers.</li>
                <li><strong>Free Trial:</strong> New users may be eligible for a 1-month free trial within 7 days of first login. This offer is one-time only and must be claimed manually.</li>
                <li><strong>Auto-Renewal:</strong> Subscriptions do not auto-renew. You must manually renew your subscription before expiration.</li>
                <li><strong>Refunds:</strong> Refund requests are handled on a case-by-case basis. Contact support for assistance.</li>
                <li><strong>Cancellation:</strong> You may cancel your subscription at any time. Access continues until the end of your paid period.</li>
                <li><strong>Pro Features Include:</strong>
                  <ul className="list-circle list-inside space-y-1 text-gray-400 ml-6 mt-2">
                    <li>Unlimited wishlist items (Free: 10 items max)</li>
                    <li>Unlimited price trackers (Free: 5 trackers max)</li>
                    <li>Advanced player statistics (ADR, MVPs, Accuracy, Rounds Played, Total Damage)</li>
                    <li>Faster price scanning (10x speed with higher concurrency)</li>
                    <li>Priority API requests</li>
                    <li>Better caching (2x longer cache duration)</li>
                    <li>Fast wishlist updates (larger batch processing)</li>
                    <li>Advanced compare stats & value breakdown</li>
                    <li>Early access to new tools and features</li>
                    <li>Price alerts via Discord</li>
                  </ul>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                5. User Responsibilities
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
                7. Data and Content
              </h2>
              <p className="text-gray-300 mb-4">
                The Service displays data from:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Steam Community Market (price data via proxy services)</li>
                <li>Steam Web API (inventory, profile data, and player statistics)</li>
                <li>Steam Community profiles (profile information, avatars)</li>
                <li>steamid.io (for Steam username resolution)</li>
                <li>CS:GO API dataset (item information, images, rarity data)</li>
                <li>Your local browser storage (wishlist, preferences, price cache, compare list)</li>
                <li>Vercel KV database (Pro subscriptions, Discord connections, price alerts)</li>
              </ul>
              <p className="text-gray-300 mt-4">
                We do not guarantee the accuracy, completeness, or timeliness of price data. Market prices are subject to change and may not reflect real-time values. Price data is cached for performance optimization (Free: 30 minutes, Pro: 2 hours).
              </p>
              <p className="text-gray-300 mt-4">
                <strong>Proxy Services:</strong> We use multiple proxy services (ScraperAPI, ZenRows, ScrapingAnt, and fallback proxies) to access Steam Community Market data. These services help bypass rate limits and improve reliability.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                8. Intellectual Property
              </h2>
              <p className="text-gray-300 mb-4">
                All content, features, and functionality of the Service are owned by SkinVault and are protected by international copyright, trademark, and other intellectual property laws. You may not:
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
                9. Limitation of Liability
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVault is provided "as is" without warranties of any kind. We are not liable for:
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
                10. Third-Party Services
              </h2>
              <p className="text-gray-300 mb-4">
                The Service integrates with third-party services that have their own privacy policies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Steam:</strong> For authentication, inventory data, player statistics, and profile information</li>
                <li><strong>Discord:</strong> For price alert notifications, bot commands, and OAuth authentication</li>
                <li><strong>Stripe:</strong> For secure payment processing (we do not store credit card details)</li>
                <li><strong>Vercel:</strong> For hosting, data storage (Vercel KV), and infrastructure</li>
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
                11. Termination
              </h2>
              <p className="text-gray-300 mb-4">
                We reserve the right to terminate or suspend your access to the Service at any time, without prior notice, for any reason, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or illegal activity</li>
                <li>Abuse of the Service</li>
                <li>Non-payment of subscription fees</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                11. Changes to Terms
              </h2>
              <p className="text-gray-300 mb-4">
                We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or through the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                12. Contact Information
              </h2>
              <p className="text-gray-300 mb-4">
                For questions about these Terms of Service, please contact us through our <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact Page</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                13. Governing Law
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
