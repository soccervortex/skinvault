"use client";

import React from 'react';
import Sidebar from '@/app/components/Sidebar';
import { FileText } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <div className="flex min-h-[100dvh] bg-[#08090d] text-white font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40 shrink-0">
                <FileText className="text-blue-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">Disclaimer</h1>
                <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                  Steam / Valve notice
                </p>
              </div>
            </div>
          </header>

          <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-6 md:space-y-8 text-[11px] md:text-[12px] leading-relaxed">
            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">Not affiliated with Valve or Steam</h2>
              <p className="text-gray-300">
                SkinVaults is an independent service and is not affiliated with, endorsed by, sponsored by, or otherwise
                approved by Valve Corporation or Steam.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">Trademarks</h2>
              <p className="text-gray-300">
                Steam and the Steam logo are trademarks and/or registered trademarks of Valve Corporation. All other
                trademarks are property of their respective owners.
              </p>
            </section>

            <section>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter mb-4 text-blue-400">Market prices</h2>
              <p className="text-gray-300">
                Market prices and inventory values shown are estimates based on available market data and caching.
                They can change and may not match the exact price you can buy/sell for at any moment.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
