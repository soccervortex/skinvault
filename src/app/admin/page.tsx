"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

const OWNER_STEAM_ID = "76561199235618867";

type ProEntry = {
  steamId: string;
  proUntil: string;
  isActive: boolean;
  daysRemaining: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [steamId, setSteamId] = useState("");
  const [months, setMonths] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ProEntry[]>([]);
  const [totals, setTotals] = useState<{ total: number; active: number; expired: number }>({
    total: 0,
    active: 0,
    expired: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("steam_user");
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const isOwner = user?.steamId === OWNER_STEAM_ID;

  useEffect(() => {
    if (!isOwner) return;
    const loadStats = async () => {
      setLoadingStats(true);
      setStatsError(null);
      try {
        const res = await fetch("/api/admin/pro/stats");
        const data = await res.json();
        if (!res.ok) {
          setStatsError(data?.error || "Failed to load stats.");
        } else {
          setEntries(data.entries || []);
          setTotals({
            total: data.total ?? 0,
            active: data.active ?? 0,
            expired: data.expired ?? 0,
          });
        }
      } catch (e: any) {
        setStatsError(e?.message || "Failed to load stats.");
      } finally {
        setLoadingStats(false);
      }
    };
    loadStats();
  }, [isOwner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!steamId || Number(months) <= 0) {
      setError("Please enter a valid SteamID64 and positive months.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
        body: JSON.stringify({ steamId, months: Number(months) }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to update Pro status.");
      } else {
        setMessage(
          `Updated Pro for ${data.steamId}, new expiry: ${data.proUntil}`
        );
        // Refresh stats after change
        const statsRes = await fetch("/api/admin/pro/stats");
        const stats = await statsRes.json();
        if (statsRes.ok) {
          setEntries(stats.entries || []);
          setTotals({
            total: stats.total ?? 0,
            active: stats.active ?? 0,
            expired: stats.expired ?? 0,
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500">
            Admin
          </p>
          <p className="text-sm text-gray-400">
            Sign in with Steam first to access the admin panel.
          </p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <AlertTriangle className="mx-auto text-amber-400 mb-2" />
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500">
            Access denied
          </p>
          <p className="text-sm text-gray-400">
            This admin panel is only available to the site owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center font-sans px-4 py-10">
      <div className="w-full max-w-5xl bg-[#11141d] border border-white/10 p-8 md:p-10 rounded-[3rem] shadow-2xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="hidden md:inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-white uppercase tracking-[0.2em]"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/40">
              <Shield className="text-emerald-400" size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                Owner Console
              </p>
              <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
                Pro Management
              </h1>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400">
          Grant or extend <span className="text-emerald-400 font-bold">Pro</span>{" "}
          for any SteamID64. Pro automatically becomes inactive when the expiry
          date passes.
        </p>

        <div className="grid md:grid-cols-3 gap-4 text-[11px]">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
            <p className="text-gray-500 uppercase font-black tracking-[0.3em] mb-1">
              Total Pro users
            </p>
            <p className="text-2xl font-black">{totals.total}</p>
          </div>
          <div className="bg-black/40 border border-emerald-500/30 rounded-2xl p-4">
            <p className="text-emerald-400 uppercase font-black tracking-[0.3em] mb-1">
              Active
            </p>
            <p className="text-2xl font-black text-emerald-400">
              {totals.active}
            </p>
          </div>
          <div className="bg-black/40 border border-red-500/30 rounded-2xl p-4">
            <p className="text-red-400 uppercase font-black tracking-[0.3em] mb-1">
              Expired
            </p>
            <p className="text-2xl font-black text-red-400">
              {totals.expired}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-[1.1fr,1.5fr] gap-8 items-start">
          <form onSubmit={handleSubmit} className="space-y-4 text-[11px]">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">
              Grant / extend Pro
            </p>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                SteamID64
              </label>
              <input
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="7656119..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                Months to add
              </label>
              <input
                type="number"
                min={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Saving..." : "Save Pro Status"}
            </button>

            {message && (
              <div className="mt-2 flex items-center gap-2 text-emerald-400 text-[11px]">
                <CheckCircle2 size={14} /> <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="mt-2 flex items-center gap-2 text-red-400 text-[11px]">
                <AlertTriangle size={14} /> <span>{error}</span>
              </div>
            )}
          </form>

          <div className="space-y-3 text-[11px]">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">
              Pro users dashboard
            </p>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 max-h-72 overflow-y-auto">
              {loadingStats ? (
                <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading stats...
                </div>
              ) : statsError ? (
                <div className="text-red-400 text-[11px]">{statsError}</div>
              ) : entries.length === 0 ? (
                <div className="text-gray-500 text-[11px]">
                  No Pro users yet.
                </div>
              ) : (
                <table className="w-full text-left text-[10px]">
                  <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                    <tr>
                      <th className="py-2 pr-2">SteamID</th>
                      <th className="py-2 pr-2">Expires</th>
                      <th className="py-2 pr-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.steamId} className="border-b border-white/5 last:border-b-0">
                        <td className="py-2 pr-2 font-mono text-[10px]">
                          {e.steamId}
                        </td>
                        <td className="py-2 pr-2">
                          {new Date(e.proUntil).toLocaleDateString()}{" "}
                          {e.isActive &&
                            `(${e.daysRemaining}d remaining)`}
                        </td>
                        <td className="py-2 pr-2">
                          {e.isActive ? (
                            <span className="text-emerald-400">Active</span>
                          ) : (
                            <span className="text-gray-500">Expired</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

