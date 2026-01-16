"use client";

import React from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Shield } from 'lucide-react';

export default function HowItWorksPage() {
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
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">How It Works</h1>
                <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                  Steam login is read-only
                </p>
              </div>
            </div>
          </header>

          <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8 text-[11px] md:text-[12px] leading-relaxed">
            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">1. Sign in with Steam (OpenID)</h2>
              <p className="text-gray-300 mb-4">
                We use official Steam OpenID to verify you own the Steam account.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>We receive your SteamID64 from Steam after you approve the login.</li>
                <li>We do not receive your Steam password.</li>
                <li>We do not request trade permissions.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">2. Read-only public data</h2>
              <p className="text-gray-300 mb-4">After login, we fetch publicly available data to build your dashboard:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Public Steam profile (name + avatar)</li>
                <li>Public CS2 inventory (if your inventory is public)</li>
                <li>Optional public CS2/Faceit stats (when available)</li>
              </ul>
              <p className="text-gray-300 mt-4">
                If your inventory or stats are private, we cannot access them.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">3. Market value estimates</h2>
              <p className="text-gray-300 mb-4">
                We estimate item values using a market price index and cached Steam market data. Prices can fluctuate.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>Fast caching is used to reduce load and improve reliability.</li>
                <li>Values are estimates and may differ from real-time market conditions.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">Security summary</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                <li>No Steam password access</li>
                <li>No trade offer access</li>
                <li>No wallet access</li>
                <li>Login verified via Steam OpenID</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
