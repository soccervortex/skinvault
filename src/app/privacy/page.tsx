"use client";

import React from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
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
                SkinVault ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
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
              </ul>
              <p className="text-gray-300 mt-4">
                <strong>Note:</strong> We only access publicly available information from your Steam profile. We do not access private inventory or profile data.
              </p>

              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                2.2 Information You Provide
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Wishlist items (stored locally in your browser)</li>
                <li>Currency preferences (EUR/USD)</li>
                <li>Contact form submissions (name, email, message, images)</li>
                <li>Payment information (processed securely through Stripe)</li>
              </ul>

              <h3 className="text-base md:text-lg font-black uppercase tracking-tighter mb-3 text-gray-400 mt-6">
                2.3 Automatically Collected Information
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>First login timestamp (for free trial eligibility)</li>
                <li>Pro subscription status and expiration dates</li>
                <li>Browser type and device information</li>
                <li>IP address (for security and analytics)</li>
                <li>Usage data (pages visited, features used)</li>
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
                <li>Displaying your inventory and statistics</li>
                <li>Processing Pro subscription payments</li>
                <li>Managing your account and preferences</li>
                <li>Sending service-related communications</li>
                <li>Responding to your contact form submissions</li>
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
                <li><strong>Browser LocalStorage:</strong> Wishlist items, currency preferences, user session data</li>
                <li><strong>Vercel KV Database:</strong> Pro subscription data, first login timestamps, claimed free month flags</li>
                <li><strong>Stripe:</strong> Payment information (we do not store credit card details)</li>
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
                <li><strong>Steam:</strong> For authentication and accessing your public profile data</li>
                <li><strong>Stripe:</strong> For payment processing (subject to Stripe's privacy policy)</li>
                <li><strong>Vercel:</strong> For hosting and data storage (subject to Vercel's privacy policy)</li>
                <li><strong>Email Service Providers:</strong> For sending contact form emails (Resend, SMTP providers)</li>
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
                <li>Your Steam authentication session</li>
                <li>Wishlist items</li>
                <li>Currency preferences</li>
                <li>Price cache data</li>
              </ul>
              <p className="text-gray-300 mt-4">
                This data is stored locally in your browser and is not transmitted to our servers except when necessary for the Service to function.
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
                <li><strong>Stripe:</strong> <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Stripe Privacy Policy</a></li>
                <li><strong>Vercel:</strong> <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Vercel Privacy Policy</a></li>
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
                <li><strong>Contact Form Data:</strong> Retained for customer support purposes</li>
                <li><strong>LocalStorage Data:</strong> Stored in your browser until you clear it</li>
              </ul>
              <p className="text-gray-300 mt-4">
                You can delete your local data at any time by clearing your browser's localStorage.
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
