"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function HelpTooltip({ content, title, position = 'top', className = '' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle mounting for Portals (Next.js SSR safety)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Prevent background scroll when open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const updatePosition = () => {
    if (!isOpen || !tooltipRef.current || !buttonRef.current) return;

    const tooltip = tooltipRef.current;
    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 12;

    // Reset styles
    tooltip.style.top = '';
    tooltip.style.bottom = '';
    tooltip.style.left = '';
    tooltip.style.right = '';
    tooltip.style.transform = '';

    // MOBILE: Absolute Center
    if (viewportWidth < 768) {
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      tooltip.style.width = '90vw';
      tooltip.style.maxWidth = '400px';
      return;
    }

    // DESKTOP: Relative to Button
    let top = 0;
    let left = 0;

    if (position === 'top') {
      top = rect.top - tooltip.offsetHeight - spacing;
      left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
    } else if (position === 'bottom') {
      top = rect.bottom + spacing;
      left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
    } else if (position === 'left') {
      top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2;
      left = rect.left - tooltip.offsetWidth - spacing;
    } else if (position === 'right') {
      top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2;
      left = rect.right + spacing;
    }

    // Edge Detection (Keep on screen)
    if (left < 10) left = 10;
    if (left + tooltip.offsetWidth > viewportWidth - 10) {
      left = viewportWidth - tooltip.offsetWidth - 10;
    }
    if (top < 10) top = 10;
    if (top + tooltip.offsetHeight > viewportHeight - 10) {
      top = viewportHeight - tooltip.offsetHeight - 10;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  };

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen]);

  const tooltipContent = (
    <>
      {/* Backdrop: High Z-index to cover everything */}
      <div
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Tooltip Container */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] bg-[#11141d] border border-white/10 rounded-2xl p-5 md:p-6 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {title && (
            <h3 className="text-[11px] md:text-xs font-black uppercase tracking-[0.2em] text-blue-400">
              {title}
            </h3>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Body */}
        <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
          {typeof content === 'string' ? (
            <p className="whitespace-pre-line">{content}</p>
          ) : (
            content
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={`inline-flex items-center ${className}`}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/50 text-blue-400 transition-all active:scale-95"
        type="button"
      >
        <HelpCircle size={16} />
      </button>

      {/* Render to body to escape parent overflow/z-index issues */}
      {isOpen && mounted && createPortal(tooltipContent, document.body)}
    </div>
  );
}