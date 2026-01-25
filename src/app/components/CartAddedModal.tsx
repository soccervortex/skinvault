"use client";

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, ShoppingCart } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
};

export default function CartAddedModal({ isOpen, onClose, title, message }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

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

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTabKey);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-added-title"
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
          aria-label="Close cart modal"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-blue-600/20 border border-blue-500/40">
            <ShoppingCart className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 id="cart-added-title" className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
              {title || 'Added to cart'}
            </h2>
            <p className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-widest mt-1">
              {message || 'Your item was added to your cart.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="w-full bg-black/40 hover:bg-black/60 border border-white/10 text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
          >
            Continue Shopping
          </button>
          <Link
            href="/checkout"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center"
            onClick={onClose}
          >
            Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
