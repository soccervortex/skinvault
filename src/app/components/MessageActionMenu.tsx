"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Flag, Trash2, Ban, UserX, Shield } from 'lucide-react';

interface MessageActionMenuProps {
  messageId?: string;
  steamId: string;
  userName: string;
  isOwnMessage: boolean;
  isAdmin: boolean;
  onReport?: () => void;
  onDelete?: () => void;
  onBan?: () => void;
  onUnban?: () => void;
  onTimeout?: () => void;
  isBanned?: boolean;
}

export default function MessageActionMenu({
  messageId,
  steamId,
  userName,
  isOwnMessage,
  isAdmin,
  onReport,
  onDelete,
  onBan,
  onUnban,
  onTimeout,
  isBanned,
}: MessageActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!isOpen && !onReport && !onDelete && !onBan && !onUnban && !onTimeout) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 hover:bg-white/10 rounded transition-colors opacity-0 group-hover:opacity-100"
        title="More options"
      >
        <MoreVertical size={14} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 bg-[#11141d] border border-white/10 rounded-lg shadow-xl min-w-[160px] overflow-hidden">
          {!isOwnMessage && onReport && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onReport();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-400 hover:bg-orange-500/10 transition-colors"
            >
              <Flag size={14} />
              Report
            </button>
          )}
          
          {isOwnMessage && messageId && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}

          {isAdmin && (
            <>
              {onTimeout && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onTimeout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <Shield size={14} />
                  Timeout
                </button>
              )}
              
              {!isBanned && onBan && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onBan();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Ban size={14} />
                  Ban User
                </button>
              )}

              {isBanned && onUnban && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onUnban();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <UserX size={14} />
                  Unban User
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

