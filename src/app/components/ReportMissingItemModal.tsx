"use client";
import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import HelpTooltip from './HelpTooltip';

interface ReportMissingItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemId: string;
  itemImage?: string;
}

export default function ReportMissingItemModal({
  isOpen,
  onClose,
  itemName,
  itemId,
  itemImage,
}: ReportMissingItemModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/item/report-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName,
          itemId,
          itemImage,
          reason: reason.trim(),
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          onClose();
          setReason('');
          setSubmitted(false);
        }, 2000);
      } else {
        alert('Failed to submit report. Please try again.');
      }
    } catch (error) {
      console.error('Error reporting item:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 max-w-lg w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="text-yellow-500" size={20} />
            </div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">
              Report Missing Item
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-400 font-black uppercase tracking-widest text-sm">
              Report Submitted!
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Thank you for helping us improve SkinVaults
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-[#08090d] rounded-xl border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Item Information
              </p>
              <p className="text-sm font-bold text-white">{itemName}</p>
              <p className="text-xs text-gray-500 mt-1">ID: {itemId}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Why is this item missing? *
                  </label>
                  <HelpTooltip
                    title="Reporting Items"
                    content={
                      <>
                        <p className="mb-2">Help us improve SkinVaults by reporting issues:</p>
                        <p className="mb-1">• Item not found in search</p>
                        <p className="mb-1">• Wrong price displayed</p>
                        <p className="mb-1">• Missing or incorrect image</p>
                        <p className="mb-1">• Item exists in game but not in our database</p>
                        <p className="text-blue-400 mt-2">We review all reports and add missing items regularly</p>
                      </>
                    }
                    position="top"
                  />
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Item not found in search, wrong price displayed, missing image..."
                  className="w-full px-4 py-3 bg-[#08090d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  rows={4}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-black/40 text-gray-400 hover:text-white hover:border-white/20 transition-all text-xs font-black uppercase tracking-widest"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reason.trim() || isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Submitting...
                    </>
                  ) : (
                    'Submit Report'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

