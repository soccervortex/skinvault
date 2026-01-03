"use client";

import React, { useState, useEffect } from 'react';
import { Dices, X, Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SurpriseMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: any[];
}

const WEAR_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Factory New', value: 'Factory New' },
  { label: 'Minimal Wear', value: 'Minimal Wear' },
  { label: 'Field-Tested', value: 'Field-Tested' },
  { label: 'Well-Worn', value: 'Well-Worn' },
  { label: 'Battle-Scarred', value: 'Battle-Scarred' },
];

const PRICE_PRESETS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Under €5', min: undefined, max: 5 },
  { label: '€5 – €20', min: 5, max: 20 },
  { label: '€20 – €100', min: 20, max: 100 },
  { label: '€100 – €500', min: 100, max: 500 },
  { label: 'Over €500', min: 500, max: undefined },
];

function parsePriceNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;
  // Remove currency symbols and spaces, normalize comma decimals.
  const cleaned = s
    .replace(/[^0-9,\.\-]/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '') // remove thousand separators like 1,234
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function makeMinMax(min: string, max: string): { minNum?: number; maxNum?: number } {
  const minNum = min && min !== '' ? parseFloat(min) : undefined;
  const maxNum = max && max !== '' ? parseFloat(max) : undefined;
  return {
    minNum: Number.isFinite(minNum as any) ? minNum : undefined,
    maxNum: Number.isFinite(maxNum as any) ? maxNum : undefined,
  };
}

export default function SurpriseMeModal({ isOpen, onClose, allItems }: SurpriseMeModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [wear, setWear] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [filteredCount, setFilteredCount] = useState(0);
  const [pricedCount, setPricedCount] = useState(0);

  const matchesFilters = (item: any, minNum?: number, maxNum?: number) => {
    const name = (item.name || '').toLowerCase();
    const weapon = (item.weapon?.name || '').toLowerCase();
    const q = query.trim().toLowerCase();

    if (q && !name.includes(q) && !weapon.includes(q)) return false;
    if (wear && item.wear?.name !== wear) return false;

    const priceNum = parsePriceNumber((item as any)?.price ?? (item as any)?.lowest_price ?? (item as any)?.median_price);

    // If a price filter is active, require an actual numeric price.
    const hasPriceFilter = minNum !== undefined || maxNum !== undefined;
    if (hasPriceFilter && priceNum === null) return false;

    if (priceNum !== null) {
      if (minNum !== undefined && priceNum < minNum) return false;
      if (maxNum !== undefined && priceNum > maxNum) return false;
    }

    return true;
  };

  // Count matching items whenever filters change
  useEffect(() => {
    const min = customMin || priceMin;
    const max = customMax || priceMax;
    const { minNum, maxNum } = makeMinMax(min, max);

    const matches = allItems.filter((item) => matchesFilters(item, minNum, maxNum));

    setFilteredCount(matches.length);

    const hasPriceFilter = minNum !== undefined || maxNum !== undefined;
    if (hasPriceFilter) {
      const priced = allItems.reduce((acc, item) => {
        const priceNum = parsePriceNumber((item as any)?.price ?? (item as any)?.lowest_price ?? (item as any)?.median_price);
        return acc + (priceNum === null ? 0 : 1);
      }, 0);
      setPricedCount(priced);
    } else {
      setPricedCount(0);
    }
  }, [query, wear, priceMin, priceMax, customMin, customMax, allItems]);

  const handleSurprise = () => {
    const min = customMin || priceMin;
    const max = customMax || priceMax;
    const { minNum, maxNum } = makeMinMax(min, max);

    const matches = allItems.filter((item) => matchesFilters(item, minNum, maxNum));

    if (matches.length === 0) {
      alert('No items match your filters. Try adjusting them.');
      return;
    }

    const random = matches[Math.floor(Math.random() * matches.length)];
    router.push(`/item/${encodeURIComponent(random.id)}`);
    onClose();
  };

  const selectPricePreset = (preset: typeof PRICE_PRESETS[0]) => {
    setPriceMin(preset.min?.toString() || '');
    setPriceMax(preset.max?.toString() || '');
    setCustomMin('');
    setCustomMax('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#08090d] border border-white/10 rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Dices className="text-amber-500" size={20} />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Surprise Me</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name/Weapon filter */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Name or Weapon</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. AK-47, Dragon Lore..."
                className="w-full bg-[#11141d] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Wear filter */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Wear</label>
            <select
              value={wear}
              onChange={(e) => setWear(e.target.value)}
              className="w-full bg-[#11141d] border border-white/5 rounded-xl py-3 px-4 text-xs outline-none focus:border-blue-500 transition-all"
            >
              {WEAR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Price filter */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Price Range (€)</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input
                type="number"
                placeholder="Min"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="bg-[#11141d] border border-white/5 rounded-xl py-3 px-4 text-xs outline-none focus:border-blue-500 transition-all"
              />
              <input
                type="number"
                placeholder="Max"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                className="bg-[#11141d] border border-white/5 rounded-xl py-3 px-4 text-xs outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRICE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => selectPricePreset(preset)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase border transition-all ${
                    priceMin === (preset.min?.toString() || '') && priceMax === (preset.max?.toString() || '')
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#11141d] border-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Match count */}
          <div className="text-center">
            <p className="text-xs text-gray-400">
              {filteredCount} item{filteredCount !== 1 ? 's' : ''} match your filters
            </p>
            {(() => {
              const min = customMin || priceMin;
              const max = customMax || priceMax;
              const { minNum, maxNum } = makeMinMax(min, max);
              const hasPriceFilter = minNum !== undefined || maxNum !== undefined;
              if (!hasPriceFilter) return null;
              if (pricedCount > 0) return null;
              return (
                <p className="mt-2 text-[10px] text-gray-500">
                  Prices are still loading for this dataset. Try again in a moment.
                </p>
              );
            })()}
          </div>

          {/* Action */}
          <button
            onClick={handleSurprise}
            disabled={filteredCount === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Dices size={16} />
            Surprise Me
          </button>
        </div>
      </div>
    </div>
  );
}
