"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { ArrowLeft, Loader2, Mail, Shield } from 'lucide-react';
import { useToast } from '@/app/components/Toast';

export default function AdminNewsletterPage() {
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [loading, setLoading] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [max, setMax] = useState('5000');
  const [sending, setSending] = useState(false);

  const templates = useMemo(() => {
    const shopUrl = 'https://www.skinvaults.online/';

    return [
      {
        id: 'infra_speed',
        name: 'Infra + Discount (FAST)',
        subject: '⚡ FAST! SkinVaults is now 100x faster (+ 20% Discount Code!)',
        text:
          `Hi SkinVaults Member,\n\n` +
          `We’ve been working hard behind the scenes to give you the best possible experience. Today, we’re excited to announce our biggest technical upgrade yet!\n\n` +
          `🚀 Massive Site Overhaul\n` +
          `We’ve officially migrated our infrastructure to Hetzner & Coolify. Here is what that means for you:\n\n` +
          `- 100x Loading Speeds: The site is now incredibly fast.\n` +
          `- Real-Time Data: Your balance and giveaway entries now update instantly.\n` +
          `- New Checkout & Cart System: Add multiple items to your cart for a smoother experience.\n\n` +
          `🎁 Celebration Promo Code\n` +
          `CODE: dio1v1\n` +
          `Use it at checkout for 20% OFF all site purchases.\n\n` +
          `Visit: ${shopUrl}\n\n` +
          `Best regards,\nThe SkinVaults Team`,
        html:
          `<h1 style="margin:0 0 10px;font-size:22px;line-height:1.2;color:#0b1220">⚡ FAST! SkinVaults is now 100x faster</h1>` +
          `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">Hi SkinVaults Member,</p>` +
          `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">We’ve been working hard behind the scenes to give you the best possible experience. Today, we’re excited to announce our biggest technical upgrade yet!</p>` +
          `<h2 style="margin:18px 0 10px;font-size:16px;line-height:1.3;color:#0b1220">🚀 Massive Site Overhaul</h2>` +
          `<ul style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.7;color:#334155">` +
          `<li><strong>100x Loading Speeds</strong> — the site feels instant.</li>` +
          `<li><strong>Real-Time Data</strong> — balance and giveaway entries update with zero delay.</li>` +
          `<li><strong>New Checkout & Cart</strong> — buy multiple items in one go.</li>` +
          `</ul>` +
          `<h2 style="margin:18px 0 10px;font-size:16px;line-height:1.3;color:#0b1220">🎁 Celebration Promo Code</h2>` +
          `<div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:14px;margin:0 0 16px">` +
          `<div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;font-weight:800">Code</div>` +
          `<div style="font-size:20px;font-weight:900;color:#0b1220;margin-top:6px">dio1v1</div>` +
          `<div style="font-size:12px;color:#64748b;margin-top:6px">Use at checkout for <strong>20% OFF</strong></div>` +
          `</div>` +
          `<div style="margin:18px 0 0">` +
          `<a href="${shopUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:900;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:12px 16px;border-radius:12px">Visit SkinVaults</a>` +
          `</div>` +
          `<p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#334155">Best regards,<br/>The SkinVaults Team</p>`,
      },
      {
        id: 'giveaways',
        name: 'Giveaways Update',
        subject: '🎉 New Giveaways are Live on SkinVaults',
        text:
          `Hi SkinVaults Member,\n\n` +
          `New giveaways are live right now. Don’t forget to use your credits and check the latest skins.\n\n` +
          `Open SkinVaults: ${shopUrl}\n\n` +
          `Good luck!\nThe SkinVaults Team`,
        html:
          `<h1 style="margin:0 0 10px;font-size:22px;line-height:1.2;color:#0b1220">🎉 New Giveaways are Live</h1>` +
          `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">Hi SkinVaults Member,</p>` +
          `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">New giveaways are live right now. Use your credits and enter while they’re fresh.</p>` +
          `<a href="${shopUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:900;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:12px 16px;border-radius:12px">Open Giveaways</a>` +
          `<p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#334155">Good luck!<br/>The SkinVaults Team</p>`,
      },
      {
        id: 'quick_announcement',
        name: 'Quick Announcement',
        subject: '📣 Update from SkinVaults',
        text:
          `Hi SkinVaults Member,\n\n` +
          `Quick update: \n\n` +
          `- (write your update here)\n\n` +
          `Thanks for being part of SkinVaults.\n\n` +
          `Open: ${shopUrl}\n\n` +
          `The SkinVaults Team`,
        html:
          `<h1 style="margin:0 0 10px;font-size:22px;line-height:1.2;color:#0b1220">📣 Update from SkinVaults</h1>` +
          `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">Hi SkinVaults Member,</p>` +
          `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155">Quick update:</p>` +
          `<ul style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.7;color:#334155">` +
          `<li>(write your update here)</li>` +
          `</ul>` +
          `<a href="${shopUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:900;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:12px 16px;border-radius:12px">Open SkinVaults</a>` +
          `<p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#334155">The SkinVaults Team</p>`,
      },
    ];
  }, []);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('infra_speed');

  const loadTemplate = () => {
    const t = templates.find((x) => x.id === selectedTemplateId);
    if (!t) return;
    setSubject(t.subject);
    setText(t.text);
    setHtml(t.html);
    toast.success(`Loaded template: ${t.name}`);
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
    try {
      const res = await fetch('/api/admin/newsletter', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as any)?.error || 'Failed to load');
      setActiveCount(Number((json as any)?.activeCount || 0));
      setTotalCount(Number((json as any)?.totalCount || 0));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load newsletter stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userIsOwner) return;
    load();
  }, [userIsOwner]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIsOwner) return;

    const s = String(subject || '').trim();
    if (!s) {
      toast.error('Missing subject');
      return;
    }

    const t = String(text || '').trim();
    const h = String(html || '').trim();
    if (!t && !h) {
      toast.error('Missing message');
      return;
    }

    setSending(true);
    try {
      const cap = Math.min(5000, Math.max(1, Math.floor(Number(max || 5000) || 5000)));
      const res = await fetch('/api/admin/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: s, text: t || undefined, html: h || undefined, max: cap }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as any)?.error || 'Failed to send');

      const sent = Number((json as any)?.sent || 0);
      const failed = Number((json as any)?.failed || 0);
      toast.success(`Sent: ${sent} • Failed: ${failed}`);
      const firstFailure = (json as any)?.failures?.[0];
      if (failed > 0 && firstFailure?.error) {
        toast.error(String(firstFailure.error));
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send newsletter');
    } finally {
      setSending(false);
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
                <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Owner</p>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Newsletter</h1>
                <p className="text-[11px] md:text-xs text-gray-400 mt-2">Broadcast updates to subscribed emails.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 rounded-[1.5rem]">
                <Shield className="text-emerald-400" size={18} />
                <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Owner only</div>
              </div>
            </div>
          </header>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
                <Mail className="text-blue-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Subscribers</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Overview</h2>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 text-[11px] py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                  <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black">Active</div>
                  <div className="mt-2 text-2xl font-black italic">{activeCount.toLocaleString('en-US')}</div>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                  <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black">Total</div>
                  <div className="mt-2 text-2xl font-black italic">{totalCount.toLocaleString('en-US')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => load()}
                  className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 text-left hover:border-white/20 transition-all"
                >
                  <div className="text-[9px] uppercase tracking-[0.35em] text-gray-500 font-black">Action</div>
                  <div className="mt-2 text-[12px] font-black uppercase tracking-wider">Refresh</div>
                </button>
              </div>
            )}
          </section>

          <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl md:rounded-2xl bg-yellow-500/10 border border-yellow-500/40 shrink-0">
                <Mail className="text-yellow-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Newsletter</p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">Send Broadcast</h2>
              </div>
            </div>

            <form onSubmit={handleSend} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-white outline-none focus:border-blue-500 transition-all"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={loadTemplate}
                    className="w-full bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-[10px] md:text-xs font-black uppercase tracking-widest"
                  >
                    Load Template
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Max recipients</label>
                  <input
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                    placeholder="5000"
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Text (optional)</label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Plain text message"
                    rows={6}
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">HTML (optional)</label>
                  <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    placeholder="<h1>Title</h1><p>Message...</p>"
                    rows={8}
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
                  />
                  <div className="mt-2 text-[9px] text-gray-500">If both are set, recipients will receive a multipart email.</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
                {sending ? 'Sending...' : 'Send Newsletter'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
