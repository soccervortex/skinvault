"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getCurrencyMetaFromSteamCode, listSteamCurrencies } from '@/app/utils/currency-preference';

export default function CurrencySettingsModal({
  isOpen,
  onClose,
  currentCode,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  onSelect: (code: string) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const currencies = useMemo(() => listSteamCurrencies(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies;
    return currencies.filter((c) => {
      return (
        c.iso.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
      );
    });
  }, [currencies, query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      closeButtonRef.current?.focus();
      searchInputRef.current?.focus();
    }, 100);

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
      if (mainContent) mainContent.removeAttribute('aria-hidden');
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const current = getCurrencyMetaFromSteamCode(currentCode);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="currency-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full max-w-xl shadow-2xl relative max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 md:top-6 right-4 md:right-6 text-gray-500 hover:text-white transition-colors z-10"
          aria-label="Close currency settings"
        >
          <X size={24} />
        </button>

        <div className="p-6 md:p-8 border-b border-white/5">
          <div>
            <h2 id="currency-settings-title" className="text-lg md:text-xl font-black uppercase tracking-tighter text-white">
              Currency Settings
            </h2>
            <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
              Current: {current.iso} ({current.symbol})
            </p>
          </div>

          <div className="mt-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search currency (e.g. EUR, USD, 3, €)"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-2.5 text-[11px] font-black"
            />
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-2 overflow-y-auto custom-scrollbar max-h-[65vh]">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">No currencies found</div>
          ) : (
            filtered.map((c) => {
              const active = String(c.code) === String(currentCode);
              return (
                <button
                  key={c.code}
                  onClick={() => {
                    onSelect(c.code);
                    onClose();
                  }}
                  className={`w-full text-left bg-black/40 border rounded-xl p-3 md:p-4 flex items-center justify-between gap-4 transition-all ${
                    active ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:border-blue-500/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] md:text-[12px] font-black uppercase tracking-tighter text-white truncate">
                      {c.iso}
                    </div>
                    <div className="mt-1 text-[9px] md:text-[10px] text-gray-500">
                      Steam code: {c.code}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] font-black text-emerald-300">{c.symbol}</div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
