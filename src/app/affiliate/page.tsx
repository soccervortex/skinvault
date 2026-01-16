"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { useToast } from '@/app/components/Toast';
import { Copy, Gift, Loader2, Users } from 'lucide-react';

type Milestone = {
  id: string;
  referralsRequired: number;
  reward:
    | { type: 'credits'; amount: number }
    | { type: 'discord_access' }
    | { type: 'wishlist_slot' }
    | { type: 'price_tracker_slot' }
    | { type: 'price_scan_boost' }
    | { type: 'cache_boost' };
  claimed: boolean;
  claimable: boolean;
};

function getRewardLabel(reward: Milestone['reward']): string {
  if (reward.type === 'credits') return `+${reward.amount} credits`;
  if (reward.type === 'discord_access') return 'Discord access';
  if (reward.type === 'wishlist_slot') return '+1 wishlist slot';
  if (reward.type === 'price_tracker_slot') return '+1 price tracker slot';
  if (reward.type === 'price_scan_boost') return 'Faster price scanning';
  if (reward.type === 'cache_boost') return 'Better cache / faster loads';
  return 'Reward';
}

export default function AffiliatePage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const [referralCount, setReferralCount] = useState<number>(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const referralLink = useMemo(() => {
    const steamId = String(user?.steamId || '').trim();
    if (!steamId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?aff=${encodeURIComponent(steamId)}`;
  }, [user?.steamId]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/affiliate/status', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setReferralCount(Number(json?.referralCount || 0));
      setMilestones(Array.isArray(json?.milestones) ? json.milestones : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
      setReferralCount(0);
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.steamId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.steamId]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const claim = async (milestoneId: string) => {
    setClaimingId(milestoneId);
    try {
      const res = await fetch('/api/affiliate/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');

      if (json?.alreadyClaimed) {
        toast.success('Already claimed');
      } else {
        const rt = String(json?.reward?.type || '');
        if (rt === 'credits') {
          toast.success(`Claimed ${Number(json?.granted || 0)} credits`);
        } else if (rt === 'discord_access') {
          toast.success('Claimed Discord access');
        } else if (rt === 'wishlist_slot') {
          toast.success('Claimed +1 wishlist slot');
        } else if (rt === 'price_tracker_slot') {
          toast.success('Claimed +1 price tracker slot');
        } else if (rt === 'price_scan_boost') {
          toast.success('Claimed price scan boost');
        } else if (rt === 'cache_boost') {
          toast.success('Claimed cache boost');
        } else {
          toast.success('Claimed');
        }
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to claim');
    } finally {
      setClaimingId(null);
    }
  };

  if (!user?.steamId) {
    return (
      <div className="flex min-h-[100dvh] bg-[#08090d] text-white font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex items-center justify-center text-gray-500 text-[11px]">Sign in with Steam first.</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] bg-[#08090d] text-white font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Affiliate</p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Invite Friends</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2 max-w-xl">
                  Share your link. When a new user signs in for the first time, it counts as a referral. Claim milestone rewards.
                </p>
              </div>
              <div className="w-full sm:w-auto flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-5 py-4 rounded-[1.5rem]">
                <Users className="text-blue-400" size={18} />
                <div>
                  <div className="text-[9px] uppercase tracking-widest font-black text-gray-500">Referrals</div>
                  <div className="text-xl font-black italic tracking-tighter">{loading ? '—' : referralCount}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black/40 border border-white/10 rounded-[1.5rem] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 w-full">
                <div className="text-[9px] uppercase tracking-widest font-black text-gray-500">Your referral link</div>
                <div title={referralLink || ''} className="text-[11px] font-black truncate mt-1">{referralLink || '—'}</div>
              </div>
              <button
                onClick={() => copy(referralLink)}
                disabled={!referralLink}
                className={`p-2 rounded-lg transition-all ${referralLink ? 'bg-white/5 hover:bg-white/10' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                aria-label="Copy referral link"
              >
                <Copy size={16} className="text-gray-300" />
              </button>
            </div>
          </header>

          <section className="bg-[#11141d] p-5 md:p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-black">Milestones</div>
              <button
                onClick={load}
                disabled={loading}
                className={`text-[10px] font-black uppercase tracking-widest transition-all ${loading ? 'text-gray-600 cursor-not-allowed' : 'text-blue-400 hover:text-blue-300'}`}
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-[11px] uppercase tracking-widest font-black">Loading</span>
              </div>
            ) : milestones.length === 0 ? (
              <div className="text-gray-500 text-[11px]">No milestones available.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {milestones.map((m) => (
                  <div key={m.id} className="bg-black/40 border border-white/5 rounded-[1.5rem] p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-black text-gray-500">{m.referralsRequired} referrals</div>
                        <div className="text-lg md:text-xl font-black italic tracking-tighter mt-1">{getRewardLabel(m.reward)}</div>
                      </div>
                      <Gift className="text-yellow-400" size={18} />
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {m.claimed ? 'CLAIMED' : m.claimable ? 'READY' : `${Math.max(0, m.referralsRequired - referralCount)} to go`}
                      </div>
                      <button
                        onClick={() => claim(m.id)}
                        disabled={!m.claimable || claimingId === m.id}
                        className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!m.claimable || claimingId === m.id) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                      >
                        {claimingId === m.id ? 'Claiming...' : (m.claimed ? 'Claimed' : 'Claim')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
