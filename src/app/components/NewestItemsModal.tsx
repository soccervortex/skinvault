"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, ExternalLink, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCurrencyMetaFromSteamCode } from '@/app/utils/currency-preference';

type NewestRow = {
  marketHashName: string;
  price: number;
  updatedAt: string | null;
};

function normalizeMarketHashName(raw: string): string {
  return String(raw || '').trim();
}

function marketHashFromItem(item: any): string {
  const raw =
    item?.market_hash_name ??
    item?.marketHashName ??
    item?.market_name ??
    item?.marketName ??
    item?.name ??
    '';

  let key = String(raw || '').trim();
  const wearName = String(item?.wear?.name || '').trim();
  if (key && wearName && !key.includes(`(${wearName})`)) {
    key = `${key} (${wearName})`;
  }
  return key;
}

function itemIdForRoute(item: any): string {
  const raw = item?.id ?? item?.market_hash_name ?? item?.marketHashName ?? item?.market_name ?? item?.marketName ?? item?.name ?? '';
  return String(raw || '').trim();
}

function formatUpdatedAt(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('en-US');
}

function formatPrice(currencyCode: string, price: number): string {
  const code = String(currencyCode || '3').trim();
  const meta = getCurrencyMetaFromSteamCode(code);
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.iso,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${meta.iso}`;
  }
}

export default function NewestItemsModal({
  isOpen,
  onClose,
  currency,
  allItems,
}: {
  isOpen: boolean;
  onClose: () => void;
  currency: { code: string; symbol: string };
  allItems: any[];
}) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NewestRow[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const itemByMarketHash = useMemo(() => {
    const map = new Map<string, any>();
    for (const it of Array.isArray(allItems) ? allItems : []) {
      const k = normalizeMarketHashName(marketHashFromItem(it));
      if (k && !map.has(k)) map.set(k, it);
    }
    return map;
  }, [allItems]);

  const fetchPage = async (nextPage: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/market/newest?currency=${encodeURIComponent(currency.code)}&page=${encodeURIComponent(String(nextPage))}&limit=6`,
        { cache: 'no-store' }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed to load newest items'));
      const list = Array.isArray(json?.items) ? (json.items as any[]) : [];
      setRows(
        list
          .map((r: any) => ({
            marketHashName: String(r?.marketHashName || '').trim(),
            price: Number(r?.price),
            updatedAt: r?.updatedAt ? String(r.updatedAt) : null,
          }))
          .filter((r: any) => r.marketHashName)
      );
      setPage(nextPage);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setRows([]);
    setPage(0);
    void fetchPage(0);
  }, [isOpen, currency.code]);

  useEffect(() => {
    if (!isOpen) return;

    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="newest-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 md:top-6 right-4 md:right-6 text-gray-500 hover:text-white transition-colors z-10"
          aria-label="Close newest items modal"
        >
          <X size={24} />
        </button>

        <div className="p-6 md:p-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-blue-400" />
            <div>
              <h2 id="newest-modal-title" className="text-lg md:text-xl font-black uppercase tracking-tighter text-white">
                Newest Items
              </h2>
              <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
                Latest market price updates
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-4 overflow-y-auto custom-scrollbar max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin text-blue-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">No items found</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const it = itemByMarketHash.get(normalizeMarketHashName(r.marketHashName));
                const title = it?.name ? String(it.name) : r.marketHashName;
                const image = it?.image ? String(it.image) : '/icon.png';
                const itemId = it ? itemIdForRoute(it) : '';

                return (
                  <button
                    key={`${r.marketHashName}_${r.updatedAt || ''}`}
                    onClick={() => {
                      if (!itemId) return;
                      router.push(`/item/${encodeURIComponent(itemId)}`);
                      onClose();
                    }}
                    disabled={!itemId}
                    className={`w-full text-left bg-black/40 border rounded-xl p-3 md:p-4 flex items-center gap-4 transition-all ${
                      itemId ? 'border-white/10 hover:border-blue-500/40' : 'border-white/5 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <img
                      src={image}
                      alt={title}
                      className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-lg bg-black/30 border border-white/5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/icon.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] md:text-[12px] font-black uppercase tracking-tighter text-white truncate">
                        {title}
                      </div>
                      <div className="mt-1 text-[9px] md:text-[10px] text-gray-500 break-all">
                        {r.marketHashName}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="text-[10px] md:text-[11px] font-black text-emerald-300">{formatPrice(currency.code, r.price)}</div>
                        <div className="text-[9px] md:text-[10px] text-gray-500">{formatUpdatedAt(r.updatedAt)}</div>
                      </div>
                    </div>
                    {itemId && (
                      <div className="shrink-0 text-gray-500">
                        <ExternalLink size={16} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 border-t border-white/5 flex items-center justify-between gap-3">
          <button
            onClick={() => void fetchPage(Math.max(0, page - 1))}
            disabled={loading || page <= 0}
            className="px-4 py-2 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-colors text-[10px] md:text-[11px] font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Page {page + 1}</div>
          <button
            onClick={() => void fetchPage(page + 1)}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors text-[10px] md:text-[11px] font-black uppercase tracking-widest"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
