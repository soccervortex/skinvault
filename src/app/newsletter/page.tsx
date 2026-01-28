"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Mail, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function NewsletterPage() {
  const [steamId, setSteamId] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [unsubmitting, setUnsubmitting] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('steam_user');
      const parsed = stored ? JSON.parse(stored) : null;
      const sid = String(parsed?.steamId || '').trim();
      if (sid) setSteamId(sid);
    } catch {
    }
  }, []);

  const canSubmit = useMemo(() => {
    return !!String(email || '').trim();
  }, [email]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(email).trim(), steamId: steamId || undefined, source: 'newsletter_page' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as any)?.error || 'Failed to subscribe');

      const status = String((json as any)?.status || 'subscribed');
      if (status === 'already_subscribed') {
        setSuccess('You are already subscribed.');
      } else {
        setSuccess('Subscribed successfully.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to subscribe');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setUnsubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(email).trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as any)?.error || 'Failed to unsubscribe');

      setSuccess('Unsubscribed successfully.');
    } catch (e: any) {
      setError(e?.message || 'Failed to unsubscribe');
    } finally {
      setUnsubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-8 pb-24">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Email</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Newsletter</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Get important updates and announcements from SkinVaults.</p>
              </div>
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30">
                <Mail className="text-blue-400" size={18} />
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-xl">
            <form className="space-y-4" onSubmit={handleSubscribe}>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Email address</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-4 px-6 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-800"
                />
              </div>

              {success && (
                <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-[11px] text-emerald-200">
                  <CheckCircle2 size={16} className="mt-0.5 text-emerald-400" />
                  <div>{success}</div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-[11px] text-red-200">
                  <XCircle size={16} className="mt-0.5 text-red-400" />
                  <div>{error}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="submit"
                  disabled={!canSubmit || submitting || unsubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Subscribing...
                    </>
                  ) : (
                    'Subscribe'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={!canSubmit || submitting || unsubmitting}
                  className="w-full bg-black/40 hover:bg-black/30 border border-white/10 hover:border-white/20 disabled:bg-slate-800 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {unsubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Unsubscribing...
                    </>
                  ) : (
                    'Unsubscribe'
                  )}
                </button>
              </div>

              <p className="text-[10px] text-gray-500 leading-relaxed">
                You can unsubscribe anytime. Every newsletter also includes an unsubscribe link.
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
