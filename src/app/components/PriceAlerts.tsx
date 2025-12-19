"use client";

import React, { useEffect, useState } from 'react';
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

interface PriceAlert {
  id: string;
  marketHashName: string;
  targetPrice: number;
  currency: string;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

export default function PriceAlerts({ steamId, isPro }: { steamId: string | null; isPro: boolean }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    marketHashName: '',
    targetPrice: '',
    currency: '3',
    condition: 'below' as 'above' | 'below',
  });

  useEffect(() => {
    if (!steamId) {
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
  }, [steamId]);

  const handleCreate = async () => {
    if (!steamId || !formData.marketHashName || !formData.targetPrice) return;

    setCreating(true);
    try {
      const res = await fetch('/api/alerts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId,
          marketHashName: formData.marketHashName,
          targetPrice: parseFloat(formData.targetPrice),
          currency: formData.currency,
          condition: formData.condition,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh alerts
        const listRes = await fetch(`/api/alerts/list?steamId=${steamId}`);
        const listData = await listRes.json();
        setAlerts(listData.alerts || []);
        setShowCreate(false);
        setFormData({
          marketHashName: '',
          targetPrice: '',
          currency: '3',
          condition: 'below',
        });
      }
    } catch (error) {
      console.error('Failed to create alert:', error);
    } finally {
      setCreating(false);
    }
  };

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

  if (!isPro) {
    return (
      <div className="bg-[#11141d] border border-white/10 rounded-xl p-4">
        <p className="text-[10px] text-gray-500">
          Price alerts are available for Pro users only.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Loading alerts...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#11141d] border border-white/10 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-blue-400" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-400">Price Alerts</h3>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
        >
          <Plus size={12} />
          New Alert
        </button>
      </div>

      {showCreate && (
        <div className="bg-black/40 border border-white/5 rounded-lg p-3 space-y-3">
          <input
            type="text"
            placeholder="Market Hash Name (e.g., AK-47 | Redline)"
            value={formData.marketHashName}
            onChange={(e) => setFormData({ ...formData, marketHashName: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white placeholder-gray-500 outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Target Price"
              value={formData.targetPrice}
              onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white placeholder-gray-500 outline-none focus:border-blue-500"
            />
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:border-blue-500"
            >
              <option value="1">USD</option>
              <option value="3">EUR</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFormData({ ...formData, condition: 'below' })}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                formData.condition === 'below'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-black/40 text-gray-500 border border-white/10'
              }`}
            >
              <TrendingDown size={12} />
              Below
            </button>
            <button
              onClick={() => setFormData({ ...formData, condition: 'above' })}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                formData.condition === 'above'
                  ? 'bg-red-600 text-white'
                  : 'bg-black/40 text-gray-500 border border-white/10'
              }`}
            >
              <TrendingUp size={12} />
              Above
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !formData.marketHashName || !formData.targetPrice}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
            >
              {creating ? 'Creating...' : 'Create Alert'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-[9px] text-gray-500 text-center py-4">
            No price alerts set. Create one to get notified when prices hit your target.
          </p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-black/40 border border-white/5 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white truncate">{alert.marketHashName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-gray-400">
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
              </div>
              <button
                onClick={() => handleDelete(alert.id)}
                className="p-1.5 text-red-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

