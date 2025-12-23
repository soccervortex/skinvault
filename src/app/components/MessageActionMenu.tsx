"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Flag, Trash2, Ban, UserX, Shield, UserCheck, Edit, Pin, PinOff } from 'lucide-react';

interface MessageActionMenuProps {
  messageId?: string;
  steamId: string;
  userName: string;
  isOwnMessage: boolean;
  isAdmin: boolean;
  onReport?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onBan?: () => void;
  onUnban?: () => void;
  onTimeout?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  isBanned?: boolean;
  isBlocked?: boolean;
  isPinned?: boolean;
}

export default function MessageActionMenu({
  messageId,
  steamId,
  userName,
  isOwnMessage,
  isAdmin,
  onReport,
  onDelete,
  onEdit,
  onPin,
  onUnpin,
  onBan,
  onUnban,
  onTimeout,
  onBlock,
  onUnblock,
  isBanned,
  isBlocked,
  isPinned,
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

  if (!isOpen && !onReport && !onDelete && !onBan && !onUnban && !onTimeout && !onBlock && !onUnblock) {
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
          
          {isOwnMessage && messageId && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onEdit();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <Edit size={14} />
              Edit
            </button>
          )}

          {((isOwnMessage || isAdmin) && messageId && onDelete) && (
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

          {isAdmin && messageId && (
            <>
              {!isPinned && onPin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onPin();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                >
                  <Pin size={14} />
                  Pin Message
                </button>
              )}

              {isPinned && onUnpin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onUnpin();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                >
                  <PinOff size={14} />
                  Unpin Message
                </button>
              )}

              {isAdmin && messageId && onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <Edit size={14} />
                  Edit (Admin)
                </button>
              )}
            </>
          )}

          {!isOwnMessage && !isBlocked && onBlock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onBlock();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <UserX size={14} />
              Block User
            </button>
          )}

          {!isOwnMessage && isBlocked && onUnblock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onUnblock();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <UserCheck size={14} />
              Unblock User
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

