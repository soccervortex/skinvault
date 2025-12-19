"use client";

import React, { useEffect, useState } from 'react';
import { MessageSquare, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface DiscordStatus {
  connected: boolean;
  discordId?: string;
  discordUsername?: string;
  discordAvatar?: string;
  connectedAt?: string;
}

export default function DiscordConnection({ steamId }: { steamId: string | null }) {
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!steamId) {
      setLoading(false);
      return;
    }

    fetch(`/api/discord/status?steamId=${steamId}`)
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [steamId]);

  const handleConnect = async () => {
    if (!steamId) return;
    
    setConnecting(true);
    try {
      const res = await fetch(`/api/discord/auth?steamId=${steamId}`);
      const data = await res.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Failed to connect Discord:', error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!steamId) return;
    
    try {
      await fetch('/api/discord/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId }),
      });
      
      setStatus({ connected: false });
    } catch (error) {
      console.error('Failed to disconnect Discord:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Checking Discord...</span>
      </div>
    );
  }

  if (!steamId) {
    return null;
  }

  return (
    <div className="bg-[#11141d] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={16} className="text-blue-400" />
        <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-400">Discord Connection</h3>
      </div>

      {status?.connected ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Connected</span>
          </div>
          {status.discordUsername && (
            <p className="text-[9px] text-gray-400">
              {status.discordUsername}
            </p>
          )}
          <button
            onClick={handleDisconnect}
            className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <XCircle size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Not Connected</span>
          </div>
          <p className="text-[9px] text-gray-500">
            Connect Discord to receive price alerts via DM
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <MessageSquare size={12} />
                Connect Discord
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

