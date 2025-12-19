"use client";

import React, { useEffect, useState } from 'react';
import { Bell, Trash2, X, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface PriceAlert {
  id: string;
  marketHashName: string;
  targetPrice: number;
  currency: string;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

interface ManagePriceTrackersProps {
  isOpen: boolean;
  onClose: () => void;
  steamId: string | null;
  isPro: boolean;
}

export default function ManagePriceTrackers({ isOpen, onClose, steamId, isPro }: ManagePriceTrackersProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !steamId) {
      setLoading(false);
      return;
    }

    fetch(`/api/alerts/list?steamId=${steamId}`)
      .then(res => res.json())
      .then(data => {
        setAlerts(data.alerts || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [isOpen, steamId]);

  const handleDelete = async (alertId: string) => {
    if (!steamId) return;

    try {
      await fetch('/api/alerts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, steamId }),
      });

      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  if (!isOpen) return null;

  const maxAlerts = isPro ? Infinity : 5;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 md:top-6 right-4 md:right-6 text-gray-500 hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-blue-400" />
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">
              Manage Price Trackers
            </h2>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] text-gray-400 text-center">
              {isPro ? 'Unlimited' : `${alerts.length} / ${maxAlerts}`} price trackers
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-500" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[10px] text-gray-500">No price trackers set</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-black/40 border border-white/5 rounded-lg p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white mb-2 truncate">{alert.marketHashName}</p>
                    <div className="flex items-center gap-2">
                      {alert.condition === 'below' ? (
                        <TrendingDown size={12} className="text-emerald-400" />
                      ) : (
                        <TrendingUp size={12} className="text-red-400" />
                      )}
                      <span className="text-[10px] text-gray-300">
                        {alert.condition === 'below' ? '≤' : '≥'}{' '}
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: alert.currency === '1' ? 'USD' : 'EUR',
                        }).format(alert.targetPrice)}
                      </span>
                      {alert.triggered && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                          Triggered
                        </span>
                      )}
                    </div>
                    <p className="text-[8px] text-gray-500 mt-1">
                      Created: {new Date(alert.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(alert.id)}
                    className="p-2 text-red-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

