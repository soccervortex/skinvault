"use client";

import React, { useState } from 'react';
import { Share2, Check, Copy, ExternalLink } from 'lucide-react';
import { useToast } from './Toast';

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  className?: string;
  variant?: 'button' | 'icon';
}

export default function ShareButton({ 
  url, 
  title, 
  text, 
  className = '',
  variant = 'icon'
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleShare = async () => {
    const shareData = {
      title: title || 'Check this out on SkinVault',
      text: text || 'Check out this CS2 skin on SkinVault',
      url: url,
    };

    // Try native Web Share API first (mobile)
    if (navigator.share && typeof window !== 'undefined') {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
        return;
      } catch (error: any) {
        // User cancelled or error occurred, fall back to copy
        if (error.name !== 'AbortError') {
          console.warn('Share failed:', error);
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link. Please copy it manually.');
    }
  };

  if (variant === 'button') {
    return (
      <button
        onClick={handleShare}
        className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${className}`}
        aria-label="Share"
      >
        {copied ? (
          <>
            <Check size={14} />
            Copied
          </>
        ) : (
          <>
            <Share2 size={14} />
            Share
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={`p-2 rounded-lg border border-white/10 bg-black/60 hover:border-blue-500 hover:bg-blue-500/10 transition-all ${className}`}
      aria-label="Share"
      title="Share"
    >
      {copied ? (
        <Check size={14} className="text-green-400" />
      ) : (
        <Share2 size={14} className="text-blue-400" />
      )}
    </button>
  );
}

