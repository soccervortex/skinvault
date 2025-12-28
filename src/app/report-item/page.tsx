"use client";

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { AlertTriangle, Loader2, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ReportItemPage() {
  const [itemName, setItemName] = useState('');
  const [itemId, setItemId] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!itemName.trim() || !reason.trim()) {
      setError('Please fill in all required fields.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/item/report-missing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: itemName.trim(),
          itemId: itemId.trim() || itemName.trim(),
          itemImage: itemImage.trim() || null,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit report.');
      } else {
        setSubmitted(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setItemName('');
          setItemId('');
          setItemImage('');
          setReason('');
          setSubmitted(false);
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-2xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Market
            </Link>

            <div className="flex items-center gap-3 mb-6 md:mb-8">
              <div className="p-2 rounded-xl md:rounded-2xl bg-yellow-500/10 border border-yellow-500/40 shrink-0">
                <AlertTriangle className="text-yellow-400" size={20} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-400 font-black">
                  Help Us Improve
                </p>
                <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">
                  Report Missing Item
                </h1>
              </div>
            </div>

            <p className="text-[10px] md:text-[11px] text-gray-400 mb-6 md:mb-8">
              Found an item that's missing from SkinVaults? Let us know! We'll review your report and add it to our database.
            </p>

            {submitted ? (
              <div className="bg-[#11141d] border border-green-500/20 rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-green-400 font-black uppercase tracking-widest text-lg mb-2">
                  Report Submitted!
                </p>
                <p className="text-gray-400 text-sm">
                  Thank you for your contribution. We will review your report shortly.
                </p>
                <p className="text-gray-500 text-xs mt-4">
                  You can submit another report in a few seconds...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 space-y-6">
                <div>
                  <label htmlFor="itemName" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    id="itemName"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="e.g., AK-47 | Redline (Field-Tested)"
                    required
                    disabled={submitting}
                  />
                  <p className="text-[9px] text-gray-500 mt-1">
                    Enter the exact item name as it appears on Steam Market
                  </p>
                </div>

                <div>
                  <label htmlFor="itemId" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    Item ID (Optional)
                  </label>
                  <input
                    type="text"
                    id="itemId"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="e.g., skin-ak47-redline-ft"
                    disabled={submitting}
                  />
                  <p className="text-[9px] text-gray-500 mt-1">
                    You can find this in the Steam Market URL or item details
                  </p>
                </div>

                <div>
                  <label htmlFor="itemImage" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    Item Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    id="itemImage"
                    value={itemImage}
                    onChange={(e) => setItemImage(e.target.value)}
                    className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="https://community.cloudflare.steamstatic.com/economy/image/..."
                    disabled={submitting}
                  />
                  <p className="text-[9px] text-gray-500 mt-1">
                    Right-click the item image on Steam Market and copy image address
                  </p>
                </div>

                <div>
                  <label htmlFor="reason" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                    Why is this item missing? *
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    placeholder="e.g., This item exists on Steam Market but I can't find it when searching on SkinVaults..."
                    required
                    disabled={submitting}
                  />
                  <p className="text-[9px] text-gray-500 mt-1">
                    Be as specific as possible to help us locate and add the item
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setItemName('');
                      setItemId('');
                      setItemImage('');
                      setReason('');
                      setError(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-black/40 text-gray-400 hover:text-white hover:border-white/20 transition-all text-xs font-black uppercase tracking-widest"
                    disabled={submitting}
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !itemName.trim() || !reason.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Report'
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 p-6 bg-[#11141d] border border-white/5 rounded-2xl">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-3">
                💡 Tips for Better Reports
              </h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Use the exact item name from Steam Market</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Include the item ID if you can find it (helps us process faster)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Describe where you found the item (Steam Market, in-game, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Check if the item already exists by searching with different terms</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

