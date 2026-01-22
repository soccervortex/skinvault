"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Save,
  Shield,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

type PromoRow = {
  promoCodeId: string;
  couponId: string;
  code: string;
  name: string | null;
  kind: 'percent' | 'amount';
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  maxRedemptions: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  singleUsePerUser?: boolean;
  creatorSlug?: string | null;
  createdAt: string;
  updatedAt: string;
  testMode: boolean;
  deletedAt: string | null;
  live?: {
    promo: {
      id: string;
      active: boolean;
      expires_at: number | null;
      max_redemptions: number | null;
      times_redeemed: number | null;
    } | null;
    coupon: {
      id: string;
      valid: boolean;
      percent_off: number | null;
      amount_off: number | null;
      currency: string | null;
      redeem_by: number | null;
    } | null;
  };
};

function toIsoOrNull(dtLocal: string): string | null {
  const s = String(dtLocal || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function fmtIso(iso: string | null | undefined): string {
  const s = String(iso || '').trim();
  if (!s) return '-';
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleString();
}

export default function AdminCouponsPage() {
  const router = useRouter();
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [testMode, setTestMode] = useState(false);
  const [rows, setRows] = useState<PromoRow[]>([]);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [percentOff, setPercentOff] = useState('20');
  const [amountOff, setAmountOff] = useState('');
  const [currency, setCurrency] = useState('eur');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [active, setActive] = useState(true);
  const [autoEnableAtStart, setAutoEnableAtStart] = useState(true);
  const [singleUsePerUser, setSingleUsePerUser] = useState(false);
  const [creatorSlug, setCreatorSlug] = useState('');

  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMaxRedemptions, setEditMaxRedemptions] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editAutoEnableAtStart, setEditAutoEnableAtStart] = useState(true);
  const [editSingleUsePerUser, setEditSingleUsePerUser] = useState(false);
  const [editCreatorSlug, setEditCreatorSlug] = useState('');

  const openEdit = (r: PromoRow) => {
    setEditing(r);
    setEditName(String(r.name || ''));
    setEditMaxRedemptions(r.maxRedemptions == null ? '' : String(r.maxRedemptions));
    setEditStartsAt(r.startsAt ? String(r.startsAt).slice(0, 16) : '');
    setEditExpiresAt(r.expiresAt ? String(r.expiresAt).slice(0, 16) : '');
    setEditActive(!!r.active);
    setEditAutoEnableAtStart((r as any)?.autoEnableAtStart !== false);
    setEditSingleUsePerUser(r.singleUsePerUser === true);
    setEditCreatorSlug(String(r.creatorSlug || ''));
  };

  const saveEdit = async () => {
    if (!userIsOwner) return;
    if (!editing) return;
    setEditSaving(true);
    try {
      const payload: any = {
        action: 'update',
        steamId: user?.steamId,
        promoCodeId: editing.promoCodeId,
        name: editName,
        maxRedemptions: editMaxRedemptions,
        startsAt: toIsoOrNull(editStartsAt),
        expiresAt: toIsoOrNull(editExpiresAt),
        active: editActive,
        autoEnableAtStart: editAutoEnableAtStart,
        singleUsePerUser: editSingleUsePerUser,
        creatorSlug: editCreatorSlug,
      };

      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String((json as any)?.error || 'Failed to update'));
        return;
      }
      toast.success('Updated');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(String(e?.message || 'Request failed'));
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const load = async () => {
    if (!userIsOwner) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/coupons?steamId=${encodeURIComponent(String(user?.steamId || ''))}&includeLive=1`,
        {
          cache: 'no-store',
          headers: {
            'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
          },
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(String((json as any)?.error || 'Failed to load coupons'));
        return;
      }
      setTestMode((json as any)?.testMode === true);
      setRows(Array.isArray((json as any)?.promos) ? (json as any).promos : []);
    } catch (e: any) {
      setError(String(e?.message || 'Request failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  const createPromo = async () => {
    if (!userIsOwner) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: any = {
        action: 'create',
        steamId: user?.steamId,
        code,
        name,
        singleUsePerUser,
        creatorSlug,
        kind,
        percentOff: kind === 'percent' ? percentOff : null,
        amountOff: kind === 'amount' ? amountOff : null,
        currency,
        maxRedemptions,
        startsAt: toIsoOrNull(startsAt),
        expiresAt: toIsoOrNull(expiresAt),
        active,
        autoEnableAtStart,
      };

      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = String((json as any)?.error || 'Failed to create coupon');
        setError(msg);
        toast.error(msg);
        return;
      }

      setMessage('Created');
      toast.success('Created');
      setCode('');
      setName('');
      setMaxRedemptions('');
      setStartsAt('');
      setExpiresAt('');
      setSingleUsePerUser(false);
      setCreatorSlug('');
      await load();
    } catch (e: any) {
      const msg = String(e?.message || 'Request failed');
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const setPromoActive = async (promoCodeId: string, nextActive: boolean) => {
    if (!userIsOwner) return;
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'set_active', steamId: user?.steamId, promoCodeId, active: nextActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String((json as any)?.error || 'Failed'));
        return;
      }
      toast.success(nextActive ? 'Enabled' : 'Disabled');
      await load();
    } catch {
      toast.error('Request failed');
    }
  };

  const deletePromo = async (promoCodeId: string) => {
    if (!userIsOwner) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this promo code?') : false;
    if (!ok) return;
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({ action: 'delete', steamId: user?.steamId, promoCodeId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(String((json as any)?.error || 'Failed'));
        return;
      }
      toast.success('Deleted');
      await load();
    } catch {
      toast.error('Request failed');
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Sign in first.</div>
      </div>
    );
  }

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-10 flex items-center justify-center text-gray-500 text-[11px]">Access denied.</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-24">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>

          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Billing</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Coupons</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">
                  Create promo codes for Stripe Checkout. Mode: {testMode ? 'TEST' : 'LIVE'}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl md:rounded-2xl bg-yellow-500/10 border border-yellow-500/40 shrink-0">
                <Tag className="text-yellow-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Create</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">New Coupon</h2>
              </div>
            </div>

            {message ? (
              <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                <CheckCircle2 size={12} /> <span>{message}</span>
              </div>
            ) : null}
            {error ? (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                <AlertTriangle size={12} /> <span>{error}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Code</div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                  placeholder="WELCOME20"
                />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Name (optional)</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                  placeholder="Welcome discount"
                />
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Type</div>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value === 'amount' ? 'amount' : 'percent')}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                >
                  <option value="percent">Percent off</option>
                  <option value="amount">Amount off (cents)</option>
                </select>
              </div>

              {kind === 'percent' ? (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Percent off</div>
                  <input
                    value={percentOff}
                    onChange={(e) => setPercentOff(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                    placeholder="20"
                  />
                </div>
              ) : (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Amount off (cents)</div>
                  <input
                    value={amountOff}
                    onChange={(e) => setAmountOff(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                    placeholder="500"
                  />
                </div>
              )}

              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Currency</div>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                  placeholder="eur"
                />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Max redemptions (optional)</div>
                <input
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                  placeholder="100"
                />
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Start date (optional)</div>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Expiry date (optional)</div>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="text-[10px] text-gray-300">
                  Create as active
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={autoEnableAtStart}
                  onChange={(e) => setAutoEnableAtStart(e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="text-[10px] text-gray-300">
                  Auto-enable when start date is reached (if start date is in the future)
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={singleUsePerUser}
                  onChange={(e) => setSingleUsePerUser(e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="text-[10px] text-gray-300">
                  Single-use per user
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black mb-2">Creator slug (optional)</div>
                <input
                  value={creatorSlug}
                  onChange={(e) => setCreatorSlug(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px]"
                  placeholder="creator-slug"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => void createPromo()}
                disabled={saving}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Tag size={14} />}
                Create
              </button>
              <button
                onClick={() => void load()}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
              >
                Refresh
              </button>
            </div>
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-gray-500 font-black">List</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Promo codes</h2>
              </div>
              <button
                onClick={() => router.push('/admin/stripe')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-300"
              >
                Stripe Settings
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-500 uppercase tracking-widest text-[9px]">
                      <th className="text-left py-2 pr-4">Code</th>
                      <th className="text-left py-2 pr-4">Discount</th>
                      <th className="text-left py-2 pr-4">Rules</th>
                      <th className="text-left py-2 pr-4">Creator</th>
                      <th className="text-left py-2 pr-4">Active</th>
                      <th className="text-left py-2 pr-4">Starts</th>
                      <th className="text-left py-2 pr-4">Expires</th>
                      <th className="text-left py-2 pr-4">Redeemed</th>
                      <th className="text-left py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const redeemed = r.live?.promo?.times_redeemed;
                      const isDeleted = !!r.deletedAt;
                      const liveActive = r.live?.promo?.active;
                      const activeLabel = typeof liveActive === 'boolean' ? liveActive : r.active;

                      return (
                        <tr key={r.promoCodeId} className={`border-t border-white/5 ${isDeleted ? 'opacity-50' : ''}`}>
                          <td className="py-3 pr-4">
                            <div className="font-black text-gray-200">
                              {r.code}
                              {testMode ? <span className="ml-2 text-yellow-400">[TEST]</span> : null}
                            </div>
                            <div className="text-gray-500 text-[10px]">{r.name || r.promoCodeId}</div>
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {r.kind === 'percent'
                              ? `${Number(r.percentOff || 0)}%`
                              : `${Number(r.amountOff || 0)} ${(r.currency || 'eur').toUpperCase()}`}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {r.singleUsePerUser === true ? '1/user' : '-'}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {r.creatorSlug ? r.creatorSlug : '-'}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${activeLabel ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                              {activeLabel ? 'Active' : 'Off'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-400">{fmtIso(r.startsAt)}</td>
                          <td className="py-3 pr-4 text-gray-400">{fmtIso(r.expiresAt)}</td>
                          <td className="py-3 pr-4 text-gray-300">{Number.isFinite(Number(redeemed)) ? String(redeemed) : '-'}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEdit(r)}
                                disabled={isDeleted}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                              >
                                <Pencil size={12} /> Edit
                              </button>
                              <button
                                onClick={() => void setPromoActive(r.promoCodeId, !activeLabel)}
                                disabled={isDeleted}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
                              >
                                {activeLabel ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => void deletePromo(r.promoCodeId)}
                                disabled={isDeleted}
                                className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-200 disabled:opacity-50 flex items-center gap-2"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {rows.length === 0 ? (
                  <div className="text-gray-500 text-[11px] py-8">No promo codes found.</div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </main>

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#11141d] border border-white/10 rounded-3xl p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-gray-500 font-black">Edit Promo</p>
                <div className="mt-1 text-[10px] text-gray-400 font-mono break-all">{editing.code}</div>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Name</p>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Starts</p>
                  <input
                    type="datetime-local"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                  />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Expires</p>
                  <input
                    type="datetime-local"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Max redemptions</p>
                <input
                  value={editMaxRedemptions}
                  onChange={(e) => setEditMaxRedemptions(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                  placeholder=""
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="text-[10px] text-gray-300">Active</div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editAutoEnableAtStart}
                  onChange={(e) => setEditAutoEnableAtStart(e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="text-[10px] text-gray-300">Auto-enable at start</div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editSingleUsePerUser}
                  onChange={(e) => setEditSingleUsePerUser(e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="text-[10px] text-gray-300">Single-use per user</div>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Creator slug</p>
                <input
                  value={editCreatorSlug}
                  onChange={(e) => setEditCreatorSlug(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[11px] font-black text-white outline-none"
                  placeholder="creator-slug"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                disabled={editSaving}
                onClick={() => setEditing(null)}
                className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-300 hover:border-white/20"
              >
                Cancel
              </button>
              <button
                disabled={editSaving}
                onClick={() => void saveEdit()}
                className="bg-blue-600/20 border border-blue-500/40 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] text-blue-300 hover:bg-blue-600/30 inline-flex items-center gap-2"
              >
                {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
