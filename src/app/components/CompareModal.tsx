"use client";
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Trash2, Scale, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface CompareItem {
  id: string;
  name: string;
  image: string;
  market_hash_name?: string;
}

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItem?: CompareItem;
  onItemSelect?: (item: CompareItem) => void;
}

import { API_FILES, BASE_URL as API_BASE_URL } from '@/data/api-endpoints';

const DATASET_CACHE_KEY = 'sv_dataset_cache_v1';

export default function CompareModal({ isOpen, onClose, currentItem, onItemSelect }: CompareModalProps) {
  const [compareList, setCompareList] = useState<CompareItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [datasetCache, setDatasetCache] = useState<Record<string, any[]>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Load compare list from localStorage
    try {
      if (typeof window === 'undefined') return;
      // Test localStorage accessibility first
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      
      const stored = window.localStorage.getItem('sv_compare_list');
      let list: CompareItem[] = stored ? JSON.parse(stored) : [];
      
      // Remove any duplicates first (by ID)
      const seen = new Set<string>();
      list = list.filter(item => {
        if (seen.has(item.id)) {
          return false; // Duplicate, remove it
        }
        seen.add(item.id);
        return true;
      });
      
      // If currentItem is provided and not already in list, add it
      if (currentItem) {
        const exists = list.find(i => i.id === currentItem.id);
        if (!exists) {
          // Add current item to the list
          list.push({
            id: currentItem.id,
            name: currentItem.name,
            image: currentItem.image,
            market_hash_name: currentItem.market_hash_name || currentItem.name,
          });
          // Keep only last 2 items (maintain order: first item in slot 1, second in slot 2)
          if (list.length > 2) {
            list = list.slice(-2); // Keep last 2 items
          }
          // Save updated list
          window.localStorage.setItem('sv_compare_list', JSON.stringify(list));
        }
      }
      
      setCompareList(list);
    } catch (error) {
      // Ignore localStorage errors
      setCompareList([]);
    }

    // Load dataset cache
    try {
      if (typeof window === 'undefined') return;
      // Test localStorage accessibility first
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      
      const cached = window.localStorage.getItem(DATASET_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cache: Record<string, any[]> = {};
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          if (value.data && Array.isArray(value.data)) {
            cache[key] = value.data;
          }
        });
        setDatasetCache(cache);
      }
    } catch (error) {
      console.error('Failed to load dataset cache:', error);
    }
  }, [isOpen, currentItem]);

  // Search items
  useEffect(() => {
    if (!searchQuery.trim() || !isOpen) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const searchWords = searchQuery.toLowerCase().trim().split(/\s+/);
    
    const searchInDataset = async (file: string) => {
      let items: any[] = [];
      
      // Check cache first
      if (datasetCache[file]) {
        items = datasetCache[file];
      } else {
        try {
          const res = await fetch(`${API_BASE_URL}/${file}`, { cache: 'force-cache' });
          const data = await res.json();
          items = Array.isArray(data) ? data : Object.values(data);
          
          // Cache it
          const newCache = { ...datasetCache };
          newCache[file] = items;
          setDatasetCache(newCache);
          
          // Persist to localStorage
          try {
            const existing = localStorage.getItem(DATASET_CACHE_KEY);
            const parsed = existing ? JSON.parse(existing) : {};
            parsed[file] = { data: items, timestamp: Date.now() };
            localStorage.setItem(DATASET_CACHE_KEY, JSON.stringify(parsed));
          } catch {}
        } catch (error) {
          console.error(`Failed to load ${file}:`, error);
          return [];
        }
      }
      
      // Filter items
      return items.filter((item: any) => {
        const name = (item.name || '').toLowerCase();
        return searchWords.every(word => name.includes(word));
      }).slice(0, 20); // Limit to 20 results per file
    };

    const performSearch = async () => {
      const allResults: any[] = [];
      
      for (const file of API_FILES) {
        const results = await searchInDataset(file);
        allResults.push(...results);
      }
      
      // Remove duplicates and sort
      const unique = Array.from(
        new Map(allResults.map(item => [item.id, item])).values()
      );
      
      setSearchResults(unique.slice(0, 50)); // Max 50 total results
      setSearchLoading(false);
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen, datasetCache]);

  const addToCompare = (item: CompareItem) => {
    // Start fresh from localStorage to avoid stale state
    try {
      const stored = localStorage.getItem('sv_compare_list');
      let newList: CompareItem[] = stored ? JSON.parse(stored) : [];
      
      // Remove duplicates first
      const seen = new Set<string>();
      newList = newList.filter(i => {
        if (seen.has(i.id)) {
          return false;
        }
        seen.add(i.id);
        return true;
      });
      
      // Check if already exists
      if (newList.find(i => i.id === item.id)) {
        return; // Already in list
      }
      
      // Add item to the end (maintains order: first item slot 1, second item slot 2)
      newList.push({
        id: item.id,
        name: item.name,
        image: item.image,
        market_hash_name: item.market_hash_name || item.name,
      });
      
      // Keep only last 2 items (preserve order)
      const finalList = newList.length > 2 ? newList.slice(-2) : newList;
      
      setCompareList(finalList);
      localStorage.setItem('sv_compare_list', JSON.stringify(finalList));
      
      if (onItemSelect) {
        onItemSelect(finalList[finalList.length - 1]);
      }
    } catch (error) {
      console.error('Failed to add to compare:', error);
    }
  };

  const removeFromCompare = (itemId: string) => {
    const newList = compareList.filter(i => i.id !== itemId);
    setCompareList(newList);
    localStorage.setItem('sv_compare_list', JSON.stringify(newList));
  };

  const clearCompare = () => {
    setCompareList([]);
    localStorage.setItem('sv_compare_list', JSON.stringify([]));
  };

  // Focus management for modal
  useEffect(() => {
    if (isOpen) {
      // Hide body content from screen readers when modal is open
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.setAttribute('aria-hidden', 'true');
      }
      
      // Focus the close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
      
      // Trap focus within modal
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
      
      document.addEventListener('keydown', handleTabKey);
      
      // Handle Escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('keydown', handleTabKey);
        document.removeEventListener('keydown', handleEscape);
        // Restore main content accessibility
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          mainContent.removeAttribute('aria-hidden');
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="compare-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <Scale className="text-blue-400" size={24} />
            <div>
              <h2 id="compare-modal-title" className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">
                Compare Items
              </h2>
              <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
                Select up to 2 items to compare
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            aria-label="Close compare modal"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
          {/* Current Compare List */}
          {compareList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">
                  Selected Items ({compareList.length}/2)
                </h3>
                {compareList.length > 0 && (
                  <button
                    onClick={clearCompare}
                    className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {compareList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center gap-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-contain rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/icon.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-tighter truncate">
                        {item.name}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCompare(item.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">
              Search Items
            </h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <label htmlFor="compare-search" className="sr-only">Search for items to compare</label>
              <input
                id="compare-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for items to compare..."
                className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Search Results */}
            {searchQuery.trim() && (
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 max-h-96 overflow-y-auto custom-scrollbar">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-blue-400" size={24} />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((item: any) => {
                      const isInList = !!compareList.find(i => i.id === item.id);
                      const canAdd = compareList.length < 2;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (!isInList && canAdd) {
                              addToCompare({
                                id: item.id,
                                name: item.name,
                                image: item.image,
                                market_hash_name: item.market_hash_name || item.name,
                              });
                            }
                          }}
                          disabled={isInList || !canAdd}
                          className={`w-full p-3 rounded-lg border transition-all text-left ${
                            isInList
                              ? 'bg-blue-500/20 border-blue-500/40 cursor-not-allowed'
                              : canAdd
                              ? 'bg-black/40 border-white/10 hover:border-blue-500 hover:bg-blue-500/10'
                              : 'bg-black/20 border-white/5 cursor-not-allowed opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-12 h-12 object-contain rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/icon.png';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black uppercase tracking-tighter truncate">
                                {item.name}
                              </p>
                              {isInList && (
                                <p className="text-[10px] text-blue-400 mt-1">Already selected</p>
                              )}
                              {!canAdd && !isInList && (
                                <p className="text-[10px] text-gray-500 mt-1">Maximum 2 items</p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No items found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 border-t border-white/5 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-400">
            {compareList.length === 0 && 'Add items to compare'}
            {compareList.length === 1 && 'Add one more item to compare'}
            {compareList.length === 2 && 'Ready to compare!'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 transition-colors text-sm font-black uppercase tracking-widest"
            >
              Cancel
            </button>
            {compareList.length === 2 && (
              <Link
                href={`/compare?id1=${encodeURIComponent(compareList[0].id)}&id2=${encodeURIComponent(compareList[1].id)}`}
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black uppercase tracking-widest transition-colors"
              >
                Compare Now
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

