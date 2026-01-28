"use client";

import React from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { AlertTriangle, Bug, Lightbulb, ArrowRight } from 'lucide-react';

export default function ReportHubPage() {
  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-24">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Support</p>
            <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Report Center</h1>
            <p className="text-[11px] md:text-xs text-gray-400 mt-2">
              Choose what you want to report. We’ll notify our team via Discord webhook and email.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/report-item?tab=item"
              className="bg-[#11141d] border border-white/5 hover:border-yellow-500/40 rounded-[1.75rem] p-6 transition-all group shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
                  <AlertTriangle className="text-yellow-400" size={18} />
                </div>
                <ArrowRight className="text-gray-600 group-hover:text-yellow-300 transition-colors" size={18} />
              </div>
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-black">Items</div>
                <div className="mt-1 text-xl font-black italic uppercase tracking-tighter">Report Missing Item</div>
                <div className="mt-2 text-[11px] text-gray-400">Tell us which skin is missing so we can add it.</div>
              </div>
            </Link>

            <Link
              href="/report-item?tab=bug"
              className="bg-[#11141d] border border-white/5 hover:border-red-500/40 rounded-[1.75rem] p-6 transition-all group shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30">
                  <Bug className="text-red-400" size={18} />
                </div>
                <ArrowRight className="text-gray-600 group-hover:text-red-300 transition-colors" size={18} />
              </div>
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-black">Bugs</div>
                <div className="mt-1 text-xl font-black italic uppercase tracking-tighter">Report a Bug</div>
                <div className="mt-2 text-[11px] text-gray-400">Something not working? Send steps and details.</div>
              </div>
            </Link>

            <Link
              href="/report-item?tab=idea"
              className="bg-[#11141d] border border-white/5 hover:border-emerald-500/40 rounded-[1.75rem] p-6 transition-all group shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                  <Lightbulb className="text-emerald-400" size={18} />
                </div>
                <ArrowRight className="text-gray-600 group-hover:text-emerald-300 transition-colors" size={18} />
              </div>
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-black">Ideas</div>
                <div className="mt-1 text-xl font-black italic uppercase tracking-tighter">Submit an Idea</div>
                <div className="mt-2 text-[11px] text-gray-400">Suggest improvements or new features.</div>
              </div>
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
