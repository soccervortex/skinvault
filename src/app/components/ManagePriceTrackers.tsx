"use client";

import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertCircle, Bell } from 'lucide-react';
import { getPriceTrackerLimit } from '@/app/utils/pro-limits';

interface PriceAlert {
  id: string;
  marketHashName: string;
  targetPrice: number;
  condition: 'above' | 'below';
  currency: string;
  triggered: boolean;
  createdAt: number;
}

interface ManagePriceTrackersProps {
  isOpen: boolean;
  onClose: () => void;
  steamId: string;
  isPro: boolean;
}

export default function ManagePriceTrackers({ isOpen, onClose, steamId, isPro }: ManagePriceTrackersProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && steamId) {
      loadAlerts();
    }
  }, [isOpen, steamId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/alerts/list?steamId=${steamId}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      setDeleting(alertId);
      const res = await fetch(`/api/alerts/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, steamId }),
      });

      if (res.ok) {
        setAlerts(alerts.filter(a => a.id !== alertId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete alert');
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
      alert('Failed to delete alert');
    } finally {
      setDeleting(null);
    }
  };

  if (!isOpen) return null;

  const currencySymbol = (code: string) => code === '1' ? '$' : '€';
  const formatPrice = (price: number, currency: string) => {
    return `${currencySymbol(currency)}${price.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] border border-white/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/40">
              <Bell className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">
                Manage Price Trackers
              </h2>
              <p className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
                {alerts.length} active tracker{alerts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <p className="text-gray-400 mt-4 text-sm">Loading trackers...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto text-gray-500 mb-4" size={48} />
            <p className="text-gray-400 text-sm">No price trackers set up yet.</p>
            <p className="text-gray-500 text-xs mt-2">Set up trackers on item pages to get price alerts!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-black/40 border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-bold text-white truncate">
                    {alert.marketHashName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {alert.condition === 'below' ? '≤' : '≥'} {formatPrice(alert.targetPrice, alert.currency)}
                    </span>
                    {alert.triggered && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Triggered
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteAlert(alert.id)}
                  disabled={deleting === alert.id}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                >
                  {deleting === alert.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {(() => {
          const maxTrackers = getPriceTrackerLimit(isPro);
          return !isPro && alerts.length >= maxTrackers && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-400">
                <strong>Free tier limit:</strong> You've reached the maximum of {maxTrackers} price trackers. Upgrade to Pro for unlimited trackers!
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

