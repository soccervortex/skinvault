"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';

export default function MyIdPage() {
  const router = useRouter();
  const [steamId, setSteamId] = useState<string | null>(null);

  useEffect(() => {
    const readSteamId = () => {
      try {
        if (typeof window === 'undefined') return;
        const savedUser = window.localStorage.getItem('steam_user');
        const parsedUser = savedUser ? JSON.parse(savedUser) : null;
        const sid = typeof parsedUser?.steamId === 'string' ? parsedUser.steamId.trim() : null;
        setSteamId(sid && /^\d{17}$/.test(sid) ? sid : null);
      } catch {
        setSteamId(null);
      }
    };

    readSteamId();
    window.addEventListener('storage', readSteamId);
    window.addEventListener('userUpdated', readSteamId as EventListener);

    return () => {
      window.removeEventListener('storage', readSteamId);
      window.removeEventListener('userUpdated', readSteamId as EventListener);
    };
  }, []);

  return (
    <div className="flex h-dvh bg-[#08090d] text-white font-sans">
      <Sidebar />
      <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">
                  My Steam64 ID
                </h1>
                <p className="mt-3 text-[10px] md:text-xs text-gray-400 max-w-2xl">
                  This page shows your Steam64 ID if you are logged in.
                </p>
              </div>
            </div>

            <div className="mt-8">
              {steamId ? (
                <div className="bg-black/20 border border-white/10 rounded-2xl p-4 md:p-6">
                  <div className="text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                    Steam64
                  </div>
                  <div className="font-mono text-sm md:text-base text-white break-all">
                    {steamId}
                  </div>
                </div>
              ) : (
                <div className="bg-black/20 border border-white/10 rounded-2xl p-4 md:p-6">
                  <div className="text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                    Not logged in
                  </div>
                  <div className="text-[11px] md:text-sm text-gray-300">
                    Please login first.
                  </div>
                  <button
                    onClick={() => router.push('/api/auth/steam')}
                    className="mt-4 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Sign In with Steam
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
