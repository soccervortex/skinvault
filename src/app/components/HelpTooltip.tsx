"use client";

import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function HelpTooltip({ content, title, position = 'top', className = '' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Position tooltip responsively
  useEffect(() => {
    if (!isOpen || !tooltipRef.current || !buttonRef.current) return;

    const tooltip = tooltipRef.current;
    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 12;

    // Reset positioning
    tooltip.style.top = '';
    tooltip.style.bottom = '';
    tooltip.style.left = '';
    tooltip.style.right = '';
    tooltip.style.transform = '';

    // Mobile: center on screen
    if (viewportWidth < 768) {
      tooltip.style.position = 'fixed';
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      tooltip.style.right = 'auto';
      tooltip.style.bottom = 'auto';
      tooltip.style.maxWidth = 'calc(100vw - 2rem)';
      tooltip.style.width = '90vw';
      return;
    }

    // Desktop: position relative to button
    let top = '';
    let bottom = '';
    let left = '';
    let right = '';
    let transform = '';

    switch (position) {
      case 'top':
        bottom = `${viewportHeight - rect.top + spacing}px`;
        left = `${rect.left + rect.width / 2}px`;
        transform = 'translateX(-50%)';
        break;
      case 'bottom':
        top = `${rect.bottom + spacing}px`;
        left = `${rect.left + rect.width / 2}px`;
        transform = 'translateX(-50%)';
        break;
      case 'left':
        right = `${viewportWidth - rect.left + spacing}px`;
        top = `${rect.top + rect.height / 2}px`;
        transform = 'translateY(-50%)';
        break;
      case 'right':
        left = `${rect.right + spacing}px`;
        top = `${rect.top + rect.height / 2}px`;
        transform = 'translateY(-50%)';
        break;
    }

    // Adjust if tooltip goes off screen
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    if (position === 'left' || position === 'right') {
      if (parseFloat(top) + tooltipHeight > viewportHeight) {
        top = `${viewportHeight - tooltipHeight - 20}px`;
      }
      if (parseFloat(top) < 20) {
        top = '20px';
      }
    } else {
      if (parseFloat(left) - tooltipWidth / 2 < 20) {
        left = `${tooltipWidth / 2 + 20}px`;
      }
      if (parseFloat(left) + tooltipWidth / 2 > viewportWidth - 20) {
        left = `${viewportWidth - tooltipWidth / 2 - 20}px`;
      }
    }

    tooltip.style.top = top || '';
    tooltip.style.bottom = bottom || '';
    tooltip.style.left = left || '';
    tooltip.style.right = right || '';
    tooltip.style.transform = transform || '';
  }, [isOpen, position]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 transition-all duration-200 shrink-0"
        aria-label="Show help information"
        type="button"
      >
        <HelpCircle size={14} className="md:w-4 md:h-4" />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Tooltip */}
          <div
            ref={tooltipRef}
            className="fixed z-[9999] bg-[#11141d] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-2xl max-w-xs md:max-w-sm w-[90vw] md:w-auto animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
              {title && (
                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-blue-400 flex-1">
                  {title}
                </h3>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all shrink-0"
                aria-label="Close help"
              >
                <X size={14} className="md:w-4 md:h-4" />
              </button>
            </div>
            
            {/* Content */}
            <div className="text-[10px] md:text-[11px] text-gray-300 leading-relaxed space-y-2">
              {typeof content === 'string' ? (
                <p>{content}</p>
              ) : (
                content
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

