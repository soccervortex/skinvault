'use client';

import React, { useEffect, useMemo, useState } from 'react';
import SpinWheel from '@/app/components/SpinWheel';
import { useToast } from '@/app/components/Toast';

function formatTimeLeft(endTime: string) {
  const totalSeconds = Math.floor((new Date(endTime).getTime() - Date.now()) / 1000);
  if (totalSeconds <= 0) return 'now';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default function SpinPage() {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [canSpin, setCanSpin] = useState(false);
  const [nextEligibleAt, setNextEligibleAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);
  const [spinOpening, setSpinOpening] = useState(false);
  const [spinReward, setSpinReward] = useState<number | null>(null);
  const [spinHistoryLoading, setSpinHistoryLoading] = useState(false);
  const [spinHistorySummary, setSpinHistorySummary] = useState<any>(null);
  const [spinHistoryAllTimeSummary, setSpinHistoryAllTimeSummary] = useState<any>(null);
  const [spinHistory, setSpinHistory] = useState<any[]>([]);
  const toast = useToast();

  const canShowStats = useMemo(() => !!spinHistorySummary || !!spinHistoryAllTimeSummary || spinHistoryLoading, [spinHistoryAllTimeSummary, spinHistoryLoading, spinHistorySummary]);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
        const parsed = stored ? JSON.parse(stored) : null;
        const sidFromStorage = String(parsed?.steamId || '').trim();
        if (/^\d{17}$/.test(sidFromStorage)) {
          if (!cancelled) setSteamId(sidFromStorage);
          return;
        }

        const sessionRes = await fetch('/api/auth/steam/session', { cache: 'no-store' });
        if (!sessionRes.ok) return;
        const sessionJson = await sessionRes.json().catch(() => null);
        const sid = String(sessionJson?.steamId || '').trim();
        if (!/^\d{17}$/.test(sid)) return;

        if (!cancelled) setSteamId(sid);
        try {
          const prevRaw = window.localStorage.getItem('steam_user');
          const prev = prevRaw ? JSON.parse(prevRaw) : null;
          const next = prev && typeof prev === 'object' ? { ...prev, steamId: sid } : { steamId: sid };
          window.localStorage.setItem('steam_user', JSON.stringify(next));
        } catch {
        }
      } catch {
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    void initAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!steamId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch('/api/spins', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setCanSpin(!!data.canSpin);
        setNextEligibleAt(data.nextEligibleAt || null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [steamId]);

  useEffect(() => {
    let cancelled = false;
    if (!steamId) {
      setSpinHistory([]);
      setSpinHistorySummary(null);
      setSpinHistoryAllTimeSummary(null);
      return;
    }

    setSpinHistoryLoading(true);
    fetch('/api/spins/history?days=30&limit=15', { cache: 'no-store' })
      .then((res) => res.json().then((j) => ({ ok: res.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) throw new Error(String(j?.error || 'Failed'));
        setSpinHistory(Array.isArray(j?.items) ? j.items : []);
        setSpinHistorySummary(j?.summary || null);
        setSpinHistoryAllTimeSummary(j?.allTimeSummary || null);
      })
      .catch(() => {
        if (cancelled) return;
        setSpinHistory([]);
        setSpinHistorySummary(null);
        setSpinHistoryAllTimeSummary(null);
      })
      .finally(() => {
        if (cancelled) return;
        setSpinHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [steamId]);

  const handleSpinClick = async () => {
    if (!canSpin || spinOpening || showSpinner) return;
    setSpinOpening(true);
    try {
      const res = await fetch('/api/spins', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(json?.error || 'Failed to spin'));
      const reward = Number(json?.reward);
      if (!Number.isFinite(reward)) throw new Error('Invalid reward');
      setSpinReward(reward);
      setShowSpinner(true);
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed to spin'));
      fetch('/api/spins', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          setCanSpin(!!data.canSpin);
          setNextEligibleAt(data.nextEligibleAt || null);
        })
        .catch(() => {
        });
    } finally {
      setSpinOpening(false);
    }
  };

  const onSpinComplete = (reward: number) => {
    toast.success(`You won ${reward} credits!`);
    setShowSpinner(false);
    setSpinReward(null);
    setCanSpin(false);
    // Refetch eligibility to get the next eligible time
    fetch('/api/spins').then(res => res.json()).then(data => setNextEligibleAt(data.nextEligibleAt));
    fetch('/api/spins/history?days=30&limit=15', { cache: 'no-store' })
      .then(res => res.json())
      .then((j) => {
        setSpinHistory(Array.isArray(j?.items) ? j.items : []);
        setSpinHistorySummary(j?.summary || null);
        setSpinHistoryAllTimeSummary(j?.allTimeSummary || null);
      })
      .catch(() => {
      });
  };

  if (authLoading) {
    return <div className="text-center p-10">Loading...</div>;
  }

  if (!steamId) {
    return (
      <div className="text-center p-10">
        <p>Please sign in to use the daily spin.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center p-10">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-4xl font-bold mb-4">Daily Spin</h1>
      {canSpin ? (
        <button
          onClick={handleSpinClick}
          disabled={spinOpening || showSpinner}
          className={`bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 px-8 rounded-lg text-2xl transition-all ${spinOpening || showSpinner ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {spinOpening || showSpinner ? 'Opening...' : 'Spin Now!'}
        </button>
      ) : (
        <div className='p-5'>
          <p className="text-xl">You have already spun today. Come back tomorrow!</p>
          {nextEligibleAt && <p>Next spin available in {formatTimeLeft(nextEligibleAt)}</p>}
        </div>
      )}
      {showSpinner && spinReward !== null && (
        <SpinWheel
          reward={spinReward}
          onSpinComplete={onSpinComplete}
          historyItems={spinHistory}
          historySummary={spinHistorySummary}
          historyAllTimeSummary={spinHistoryAllTimeSummary}
          historyLoading={spinHistoryLoading}
          onClose={() => {
            setShowSpinner(false);
            setSpinReward(null);
          }}
        />
      )}
    </div>
  );
}
