"use client";

import React from 'react';
import Sidebar from '@/app/components/Sidebar';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
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
                <li>Real-time inventory value tracking</li>
                <li>Skin price monitoring and analytics</li>
                <li>Wishlist functionality</li>
                <li>Player statistics and portfolio analytics</li>
                <li>Pro subscription features (unlimited wishlist, advanced stats, faster performance)</li>
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
                4. Pro Subscription
              </h2>
              <p className="text-gray-300 mb-4">
                SkinVault offers a Pro subscription service with the following terms:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Pricing:</strong> €9.99/month, €24.99/3 months, €44.99/6 months</li>
                <li><strong>Payment:</strong> Processed through Stripe. All payments are final unless otherwise stated.</li>
                <li><strong>Free Trial:</strong> New users may be eligible for a 1-month free trial within 7 days of first login. This offer is one-time only.</li>
                <li><strong>Auto-Renewal:</strong> Subscriptions do not auto-renew. You must manually renew your subscription.</li>
                <li><strong>Refunds:</strong> Refund requests are handled on a case-by-case basis. Contact support for assistance.</li>
                <li><strong>Cancellation:</strong> You may cancel your subscription at any time. Access continues until the end of your paid period.</li>
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
                6. Data and Content
              </h2>
              <p className="text-gray-300 mb-4">
                The Service displays data from:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Steam Community Market (price data)</li>
                <li>Steam API (inventory and profile data)</li>
                <li>Your local browser storage (wishlist, preferences)</li>
              </ul>
              <p className="text-gray-300 mt-4">
                We do not guarantee the accuracy, completeness, or timeliness of price data. Market prices are subject to change and may not reflect real-time values.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                7. Intellectual Property
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
                8. Limitation of Liability
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
                9. Third-Party Services
              </h2>
              <p className="text-gray-300 mb-4">
                The Service integrates with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li><strong>Steam:</strong> For authentication and inventory data</li>
                <li><strong>Stripe:</strong> For payment processing</li>
                <li><strong>Vercel:</strong> For hosting and data storage</li>
              </ul>
              <p className="text-gray-300 mt-4">
                Your use of these third-party services is subject to their respective terms and privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">
                10. Termination
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
  );
}
