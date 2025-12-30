"use client";

import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function HelpTooltip({ content, title, position = 'top', className = '' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
        aria-label="Show help information"
        type="button"
      >
        <HelpCircle size={14} />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Tooltip */}
          <div
            className={`absolute z-[9999] bg-[#11141d] border border-white/20 rounded-xl p-4 shadow-2xl max-w-xs ${
              position === 'top' ? 'bottom-full mb-2' :
              position === 'bottom' ? 'top-full mt-2' :
              position === 'left' ? 'right-full mr-2' :
              'left-full ml-2'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              {title && (
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">
                  {title}
                </h3>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-0.5 text-gray-400 hover:text-white transition-colors shrink-0"
                aria-label="Close help"
              >
                <X size={12} />
              </button>
            </div>
            <div className="text-[10px] text-gray-300 leading-relaxed">
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

