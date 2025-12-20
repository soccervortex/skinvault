"use client";

import React, { useEffect, useState } from 'react';
import { X, Bell, TrendingUp, TrendingDown, Loader2, User, MessageSquare, CheckCircle2 } from 'lucide-react';
import { getPriceTrackerLimitSync, preloadRewards } from '@/app/utils/pro-limits';

interface PriceTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    image: string;
    market_hash_name?: string;
  };
  user: any;
  isPro: boolean;
  currency: { code: string; symbol: string };
}

export default function PriceTrackerModal({ isOpen, onClose, item, user, isPro, currency }: PriceTrackerModalProps) {
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('below');
  const [creating, setCreating] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<any>(null);
  const [loadingDiscord, setLoadingDiscord] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [maxAlerts, setMaxAlerts] = useState(5);

  const marketHashName = item.market_hash_name || item.name;

  useEffect(() => {
    if (!isOpen || !user?.steamId) return;

    // Load rewards to refresh cache and update limit
    preloadRewards(user.steamId).then(() => {
      setMaxAlerts(getPriceTrackerLimitSync(isPro));
    }).catch(() => {
      setMaxAlerts(getPriceTrackerLimitSync(isPro));
    });

    // Check Discord status
    fetch(`/api/discord/status?steamId=${user.steamId}`)
      .then(res => res.json())
      .then(data => {
        setDiscordStatus(data);
        setLoadingDiscord(false);
      })
      .catch(() => setLoadingDiscord(false));

    // Load existing alerts for this item
    fetch(`/api/alerts/list?steamId=${user.steamId}`)
      .then(res => res.json())
      .then(data => {
        const itemAlerts = (data.alerts || []).filter((a: any) => a.marketHashName === marketHashName);
        setAlerts(itemAlerts);
        setLoadingAlerts(false);
      })
      .catch(() => setLoadingAlerts(false));
  }, [isOpen, user?.steamId, marketHashName]);

  const handleCreate = async () => {
    if (!user?.steamId || !targetPrice || !discordStatus?.connected) return;

    setCreating(true);
    try {
      const res = await fetch('/api/alerts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId: user.steamId,
          marketHashName,
          targetPrice: parseFloat(targetPrice),
          currency: currency.code,
          condition,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        // Refresh alerts
        const listRes = await fetch(`/api/alerts/list?steamId=${user.steamId}`);
        const listData = await listRes.json();
        const itemAlerts = (listData.alerts || []).filter((a: any) => a.marketHashName === marketHashName);
        setAlerts(itemAlerts);
        setTargetPrice('');
        setCondition('below');
      } else {
        alert(data.error || 'Failed to create alert');
      }
    } catch (error) {
      console.error('Failed to create alert:', error);
      alert('Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!user?.steamId) return;

    try {
      await fetch('/api/alerts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, steamId: user.steamId }),
      });

      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const handleConnectDiscord = () => {
    if (!user?.steamId) return;
    fetch(`/api/discord/auth?steamId=${user.steamId}`)
      .then(res => res.json())
      .then(data => {
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      });
  };

  if (!isOpen) return null;

  const canCreateMore = alerts.length < maxAlerts;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 md:top-6 right-4 md:right-6 text-gray-500 hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
              <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter text-white mb-1 truncate">
                Price Tracker
              </h2>
              <p className="text-[10px] md:text-[11px] text-gray-400 truncate">{marketHashName}</p>
            </div>
          </div>

          {/* User Profile Section */}
          {user && (
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border border-blue-500/50 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest truncate">
                    {user.name}
                  </p>
                  {isPro && (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[8px] font-black uppercase tracking-widest text-emerald-400 mt-1">
                      Pro
                    </span>
                  )}
                </div>
              </div>

              {/* Discord Connection Status */}
              {loadingDiscord ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Checking Discord...</span>
                </div>
              ) : discordStatus?.connected ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Discord: {discordStatus.discordUsername}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <MessageSquare size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Discord Not Connected</span>
                  </div>
                  <button
                    onClick={handleConnectDiscord}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    <MessageSquare size={12} />
                    Connect Discord
                  </button>
                </div>
              )}
            </div>
          )}

          {!user ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
              <p className="text-[10px] text-yellow-400">
                Please sign in with Steam to create price trackers
              </p>
            </div>
          ) : !discordStatus?.connected ? (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
              <p className="text-[10px] text-blue-400">
                Connect Discord to receive price alerts via DM
              </p>
            </div>
          ) : (
            <>
              {/* Alert Limit Info */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                <p className="text-[9px] text-gray-400 text-center">
                  {isPro ? 'Unlimited' : `${alerts.length} / ${maxAlerts}`} price trackers
                  {!isPro && alerts.length >= maxAlerts && (
                    <span className="block mt-1 text-yellow-400">Upgrade to Pro for unlimited trackers</span>
                  )}
                </p>
              </div>

              {/* Create New Alert */}
              {canCreateMore && (
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-400">Create Alert</h3>
                  
                  <div className="space-y-3">
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Target Price (${currency.symbol})`}
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white placeholder-gray-500 outline-none focus:border-blue-500"
                    />
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCondition('below')}
                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          condition === 'below'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-black/40 text-gray-500 border border-white/10'
                        }`}
                      >
                        <TrendingDown size={12} />
                        Below
                      </button>
                      <button
                        onClick={() => setCondition('above')}
                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          condition === 'above'
                            ? 'bg-red-600 text-white'
                            : 'bg-black/40 text-gray-500 border border-white/10'
                        }`}
                      >
                        <TrendingUp size={12} />
                        Above
                      </button>
                    </div>

                    <button
                      onClick={handleCreate}
                      disabled={creating || !targetPrice}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      {creating ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Bell size={12} />
                          Create Alert
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Alerts */}
              {loadingAlerts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-gray-500" />
                </div>
              ) : alerts.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-400">Active Alerts</h3>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="bg-black/40 border border-white/5 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-white">
                          {alert.condition === 'below' ? '≤' : '≥'}{' '}
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: alert.currency === '1' ? 'USD' : 'EUR',
                          }).format(alert.targetPrice)}
                        </p>
                        {alert.triggered && (
                          <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded mt-1 inline-block">
                            Triggered
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="p-1.5 text-red-500 hover:text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[9px] text-gray-500">No active alerts for this item</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

