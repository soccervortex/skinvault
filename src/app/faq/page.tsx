"use client";

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string | JSX.Element;
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqCategories: { title: string; items: FAQItem[] }[] = [
    {
      title: "General Questions",
      items: [
        {
          question: "What is SkinVaults?",
          answer: "SkinVaults is a CS2 (Counter-Strike 2) skin inventory tracking and analytics platform. We help you track your skin collection value, monitor market prices, set price alerts, compare skins, and analyze your portfolio. SkinVaults is a read-only analytics tool - we do not buy, sell, or trade skins."
        },
        {
          question: "Is SkinVaults free to use?",
          answer: "Yes! SkinVaults offers a free tier with essential features including inventory tracking, basic wishlist (10 items), skin comparison, and basic statistics. We also offer a Pro subscription with advanced features like unlimited wishlist, unlimited price trackers, advanced stats, and faster performance."
        },
        {
          question: "Do I need to create an account?",
          answer: "Yes, you need to sign in with Steam to use SkinVaults. We use official Steam OpenID authentication, which is secure and trusted. You'll be redirected to Steam's official website to log in - we never see or store your Steam password."
        },
        {
          question: "What platforms does SkinVaults support?",
          answer: "SkinVaults is a web-based platform that works on all modern browsers (Chrome, Firefox, Safari, Edge) and devices (desktop, tablet, mobile). We also offer a Discord bot for price checks and alerts, and you can access your data from any device."
        }
      ]
    },
    {
      title: "Safety & Security",
      items: [
        {
          question: "Is SkinVaults safe?",
          answer: "Yes, SkinVaults is completely safe. We use official Steam OpenID for authentication, which is the same secure system used by legitimate Steam partners. SkinVaults only reads your public inventory data - we never modify, transfer, or access your Steam account. We are a read-only analytics tool, not a trading platform."
        },
        {
          question: "Can SkinVaults access my Steam account?",
          answer: "No, SkinVaults cannot access your Steam account. We only have read-only access to your public inventory data through Steam's official API. We cannot modify items, transfer skins, access your account settings, or make any changes to your Steam account. We are a read-only analytics service."
        },
        {
          question: "Does SkinVaults store my Steam password?",
          answer: "No, SkinVaults never sees or stores your Steam password. We use Steam OpenID, which means you log in directly through Steam's official website. Steam then provides us with a secure authentication token. Your password never leaves Steam's servers."
        },
        {
          question: "Is SkinVaults a gambling site?",
          answer: "No, SkinVaults is NOT a gambling site. We are a legitimate analytics and inventory management tool for CS2 skins. We do not offer any gambling, betting, or casino services. SkinVaults helps users track their inventory value and monitor skin prices."
        },
        {
          question: "Does SkinVaults buy or sell skins?",
          answer: "No, SkinVaults does NOT buy or sell skins. We are purely an analytics and inventory management tool. We do not facilitate trading, buying, or selling of skins. SkinVaults is a read-only service that helps you track and analyze your CS2 skin collection."
        },
        {
          question: "Is SkinVaults a trading platform?",
          answer: "No, SkinVaults is NOT a trading platform. We are an analytics and inventory management tool. We do not facilitate trading between users, operate as a marketplace, or handle any transactions. SkinVaults is a read-only service that helps you track and analyze your CS2 skin collection."
        }
      ]
    },
    {
      title: "Features & Functionality",
      items: [
        {
          question: "What features does SkinVaults offer?",
          answer: (
            <div className="space-y-2">
              <p className="mb-2">SkinVaults offers a comprehensive set of features:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
                <li>Real-time inventory value tracking and portfolio management</li>
                <li>Skin price monitoring with market data</li>
                <li>Wishlist functionality (Free: 10 items, Pro: unlimited)</li>
                <li>Price alerts via Discord (Pro: unlimited, Free: 3 with Discord Access purchase)</li>
                <li>Player statistics and portfolio analytics</li>
                <li>Faceit statistics integration (ELO, level, K/D ratio, win rate, and more)</li>
                <li>Skin comparison tool (compare up to 2 items side by side)</li>
                <li>Player search by Steam ID, username, Discord username, or Discord ID</li>
                <li>Community chat system with global chat and direct messages</li>
                <li>Discord bot with comprehensive commands</li>
              </ul>
            </div>
          )
        },
        {
          question: "How accurate are the prices?",
          answer: "SkinVaults pulls price data from the Steam Community Market through official APIs and proxy services. Prices are updated regularly and cached for performance (Free: 30 minutes, Pro: 2 hours, or 1 hour with Cache Boost). While we strive for accuracy, market prices can change rapidly, and cached prices may not reflect real-time values. Always verify prices on the Steam Community Market before making trading decisions."
        },
        {
          question: "How does the wishlist work?",
          answer: "The wishlist allows you to save skins you're interested in tracking. Free users can save up to 10 items, while Pro users have unlimited wishlist items. You can also purchase additional wishlist slots as consumables. Your wishlist is stored locally in your browser and can optionally be synced to our servers for cross-device access."
        },
        {
          question: "What is the compare feature?",
          answer: "The compare feature lets you compare up to 2 skins side by side. You can see detailed statistics, prices, and value breakdowns for each item. This helps you make informed decisions when choosing between different skins. The compare list is stored locally in your browser."
        },
        {
          question: "What are Faceit statistics?",
          answer: "Faceit statistics show your CS2 performance data from Faceit, including ELO, level, K/D ratio, win rate, headshot percentage, KAST, and more. Basic stats are available to all users, while Pro users get access to advanced statistics like matches played, total kills/deaths/assists, MVPs, and averages. Statistics are fetched from the Faceit API and may be cached for performance."
        },
        {
          question: "How does the community chat work?",
          answer: "SkinVaults includes a community chat system with global chat (visible to all users) and direct messages (private one-on-one conversations). You can send DM invites to other users, edit messages, and report inappropriate content. Admins can moderate chat, timeout users, and ban violators. Chat messages are stored in our database for moderation purposes."
        }
      ]
    },
    {
      title: "Pro Subscription",
      items: [
        {
          question: "What is Pro and what does it include?",
          answer: (
            <div className="space-y-2">
              <p className="mb-2">Pro subscription unlocks advanced features:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
                <li>Unlimited wishlist items (Free: 10 items max)</li>
                <li>Unlimited price trackers (Free: 3 with Discord Access purchase)</li>
                <li>Advanced player statistics (ADR, MVPs, Accuracy, Rounds Played, Total Damage)</li>
                <li>Faster price scanning (10x speed with higher concurrency)</li>
                <li>Priority API requests</li>
                <li>Better caching (2x longer cache duration - 2 hours vs 30 minutes)</li>
                <li>Fast wishlist updates (larger batch processing)</li>
                <li>Advanced compare stats & value breakdown</li>
                <li>Early access to new tools and features</li>
                <li>Price alerts via Discord</li>
              </ul>
            </div>
          )
        },
        {
          question: "How much does Pro cost?",
          answer: "Pro subscription pricing: €9.99/month, €24.99/3 months (save €5), or €44.99/6 months (save €15). All payments are processed securely through Stripe. We do not store credit card details on our servers."
        },
        {
          question: "Is there a free trial?",
          answer: "Yes! New users may be eligible for a 1-month free trial within 7 days of first login. This offer is one-time only and must be claimed manually. The offer expires after 7 days if not claimed. Check your account page to see if you're eligible."
        },
        {
          question: "Does Pro auto-renew?",
          answer: "No, Pro subscriptions do not auto-renew. You must manually renew your subscription before expiration. We'll notify you when your subscription is about to expire so you can renew if desired."
        },
        {
          question: "Can I get a refund?",
          answer: "Refund requests are handled on a case-by-case basis. Please contact us through our contact page with your purchase details and reason for the refund request. We'll review your request and respond within 24-48 hours."
        },
        {
          question: "What are consumables?",
          answer: (
            <div className="space-y-2">
              <p className="mb-2">Consumables are one-time purchases that enhance your free account and never expire:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
                <li><strong>Wishlist Slots (€1.99):</strong> Add one additional item to your wishlist</li>
                <li><strong>Discord Access (€4.99):</strong> Get Discord bot access and create up to 3 price trackers</li>
                <li><strong>Price Scan Boost (€2.49):</strong> Increase concurrent price scans from 3 to 5</li>
                <li><strong>Price Cache Boost (€1.99):</strong> Extend price cache duration from 30 minutes to 1 hour</li>
              </ul>
              <p className="mt-2 text-gray-400">Note: Pro users already have access to all consumable benefits, so they don't need to purchase consumables.</p>
            </div>
          )
        }
      ]
    },
    {
      title: "Discord Integration",
      items: [
        {
          question: "How does Discord integration work?",
          answer: "You can optionally connect your Discord account to receive price alert notifications and use our Discord bot. When you connect Discord, we store your Discord ID, username, avatar, and OAuth tokens (for sending alerts). You can disconnect your Discord account at any time, which will remove all active price trackers."
        },
        {
          question: "What Discord bot commands are available?",
          answer: (
            <div className="space-y-2">
              <p className="mb-2">Our Discord bot offers comprehensive commands:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
                <li><code className="text-blue-400">/wishlist</code> - View your wishlist with current prices</li>
                <li><code className="text-blue-400">/alerts</code> - View your active price alerts</li>
                <li><code className="text-blue-400">/inventory</code> - View your inventory summary</li>
                <li><code className="text-blue-400">/price &lt;item&gt;</code> - Check current price of a CS2 skin</li>
                <li><code className="text-blue-400">/vault</code> - View your total vault value and statistics</li>
                <li><code className="text-blue-400">/stats</code> - View your CS2 player statistics</li>
                <li><code className="text-blue-400">/player &lt;query&gt;</code> - Search for a player</li>
                <li><code className="text-blue-400">/compare &lt;item1&gt; &lt;item2&gt;</code> - Compare skins</li>
                <li><code className="text-blue-400">/help</code> - Get help with all commands</li>
              </ul>
            </div>
          )
        },
        {
          question: "How do price alerts work?",
          answer: "Price alerts (trackers) notify you when a skin reaches your target price. Pro users have unlimited trackers, while free users can purchase Discord Access to get 3 trackers. When a tracked skin reaches your target price, you'll receive a direct message from our Discord bot. You can manage your alerts through the website or using the /alerts Discord command."
        },
        {
          question: "Can I use the Discord bot without connecting my account?",
          answer: "No, you need to connect your Discord account to use the bot commands. The bot requires authentication to access your data and send you alerts. You can connect your Discord account through your profile settings on the website."
        }
      ]
    },
    {
      title: "Account & Data",
      items: [
        {
          question: "What data does SkinVaults collect?",
          answer: "SkinVaults collects only your public Steam inventory data (skin names, quantities, and market values) and basic account information (Steam ID, username, avatar) provided by Steam OpenID. If you connect Discord, we also collect your Discord ID, username, avatar, and OAuth tokens. We do not collect passwords, payment information (processed securely through Stripe), or private account data. All data is processed securely and in accordance with our Privacy Policy."
        },
        {
          question: "Where is my data stored?",
          answer: "Your data is stored in multiple locations: browser localStorage (wishlist, preferences, price cache), Vercel KV database (primary - Pro subscriptions, Discord connections, price alerts, purchase history), and MongoDB (backup/fallback database). We use a dual-database system for reliability - if one fails, the system automatically switches to the other."
        },
        {
          question: "Can I delete my data?",
          answer: "Yes, you can delete your local data at any time by clearing your browser's localStorage. You can disconnect your Discord account at any time, which will remove all Discord-related data and price trackers. To request deletion of server-stored data, contact us through our contact page."
        },
        {
          question: "How do I disconnect my Discord account?",
          answer: "You can disconnect your Discord account through your profile settings on the website. Disconnecting will remove all Discord-related data, including active price trackers. You can reconnect at any time if you want to use Discord features again."
        },
        {
          question: "What happens if I'm banned?",
          answer: "If you're banned from SkinVaults, you'll be immediately logged out and redirected to the contact page. Banned users cannot access the Service or create new accounts using the same Steam ID. Ban decisions are final, but you may contact support to appeal. If you are unbanned, your account access will be restored immediately."
        }
      ]
    },
    {
      title: "Technical & Support",
      items: [
        {
          question: "Why are prices not updating?",
          answer: "Prices are cached for performance optimization. Free users have a 30-minute cache, Pro users have a 2-hour cache, and users with Cache Boost have a 1-hour cache. If prices seem outdated, wait for the cache to expire or clear your browser's localStorage. Also, ensure your internet connection is working properly."
        },
        {
          question: "Why can't I see my inventory?",
          answer: "Make sure your Steam inventory is set to public. SkinVaults can only access public inventory data. Also, ensure you're signed in with the correct Steam account. If issues persist, try refreshing the page or clearing your browser cache."
        },
        {
          question: "Why aren't my Faceit statistics showing?",
          answer: "Faceit statistics are only displayed if you have a Faceit account linked to your Steam ID or if we can find you by your Faceit nickname. If you're not found on Faceit, no statistics will be displayed - this is normal and not an error. Make sure your Faceit account is properly linked to your Steam account."
        },
        {
          question: "How do I contact support?",
          answer: "You can contact us through our contact page at /contact. Send us an email with your issue, including your name, email, and a detailed description. We typically respond within 24-48 hours. For urgent payment or account issues, please include 'URGENT' in your subject line."
        },
        {
          question: "The website is slow or not loading. What should I do?",
          answer: "Try the following: clear your browser cache, check your internet connection, try a different browser, or wait a few minutes and refresh. If the issue persists, contact us through our contact page. Pro users get priority API requests and faster performance."
        },
        {
          question: "Can I use SkinVaults on mobile?",
          answer: "Yes! SkinVaults is fully responsive and works on mobile devices. You can access all features from your phone or tablet. The website is optimized for mobile browsers and can be added to your home screen for quick access."
        }
      ]
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
                <HelpCircle className="text-blue-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                  Frequently Asked Questions
                </h1>
                <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                  Everything you need to know about SkinVaults
                </p>
              </div>
            </div>
          </header>

          <div className="space-y-8">
            {faqCategories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter mb-6 text-blue-400">
                  {category.title}
                </h2>
                <div className="space-y-4">
                  {category.items.map((item, itemIndex) => {
                    const globalIndex = categoryIndex * 1000 + itemIndex;
                    const isOpen = openIndex === globalIndex;
                    
                    return (
                      <div
                        key={itemIndex}
                        className="border border-white/10 rounded-xl md:rounded-2xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleFAQ(globalIndex)}
                          className="w-full p-4 md:p-6 text-left flex items-center justify-between gap-4 hover:bg-white/5 transition-all"
                        >
                          <h3 className="text-sm md:text-base font-black uppercase tracking-tighter text-white pr-4">
                            {item.question}
                          </h3>
                          <div className="shrink-0">
                            {isOpen ? (
                              <ChevronUp className="text-blue-400" size={20} />
                            ) : (
                              <ChevronDown className="text-gray-400" size={20} />
                            )}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-4 md:px-6 pb-4 md:pb-6 pt-0">
                            <div className="text-[11px] md:text-[12px] text-gray-300 leading-relaxed">
                              {typeof item.answer === 'string' ? (
                                <p>{item.answer}</p>
                              ) : (
                                item.answer
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10">
            <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
              Still Have Questions?
            </h2>
            <p className="text-[11px] md:text-[12px] text-gray-300 mb-4 leading-relaxed">
              Can't find the answer you're looking for? We're here to help!
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-[11px] md:text-[12px] font-black uppercase tracking-widest transition-all"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

