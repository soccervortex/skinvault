"use client";

import React from 'react';
import Sidebar from '@/app/components/Sidebar';
import ReviewSection from '@/app/components/ReviewSection';

export default function ReviewsPage() {
  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-2xl">
            <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-4">
              Customer Reviews
            </h1>
          </header>
          <ReviewSection />
        </div>
      </main>
    </div>
  );
}
