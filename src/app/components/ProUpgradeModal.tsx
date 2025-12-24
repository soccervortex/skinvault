"use client";

import React, { useEffect, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="pro-upgrade-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        className="bg-[#11141d] border border-white/10 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] w-full max-w-lg shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 md:top-8 right-4 md:right-8 text-gray-500 hover:text-white transition-colors"
          aria-label="Close upgrade modal"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40">
            <Lock className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 id="pro-upgrade-title" className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
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
            aria-label="Close upgrade modal"
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















