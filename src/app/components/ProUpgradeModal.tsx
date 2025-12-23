"use client";

import React from 'react';
import Link from 'next/link';
import { X, Crown, Lock, ArrowRight } from 'lucide-react';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  feature?: string;
  limit?: number;
  currentCount?: number;
}

export default function ProUpgradeModal({
  isOpen,
  onClose,
  title,
  message,
  feature,
  limit,
  currentCount,
}: ProUpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] border border-white/10 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] w-full max-w-lg shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 md:top-8 right-4 md:right-8 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40">
            <Lock className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
              {title}
            </h2>
            {feature && (
              <p className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-widest mt-1">
                {feature}
              </p>
            )}
          </div>
        </div>

        <p className="text-[11px] md:text-[12px] text-gray-300 mb-6 leading-relaxed">
          {message}
        </p>

        {limit !== undefined && currentCount !== undefined && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                Current Usage
              </span>
              <span className="text-[11px] font-black text-white">
                {currentCount} / {limit}
              </span>
            </div>
            <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all"
                style={{ width: `${(currentCount / limit) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/pro"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-blue-600/20"
          >
            <Crown size={16} />
            Upgrade to Pro
            <ArrowRight size={16} />
          </Link>
          <button
            onClick={onClose}
            className="w-full bg-black/40 border border-white/10 text-gray-400 hover:text-white py-3 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all"
          >
            Maybe Later
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-white/5">
          <p className="text-[9px] md:text-[10px] text-gray-500 text-center">
            Pro unlocks unlimited wishlist, advanced stats, price alerts, and more
          </p>
        </div>
      </div>
    </div>
  );
}










