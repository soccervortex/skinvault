"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import {
  Loader2,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Trash2,
  Edit,
  Ban,
  ShoppingBag,
  X,
  Clock,
  Search,
  Flag,
} from "lucide-react";
import { ThemeType } from "@/app/utils/theme-storage";
import { isOwner } from "@/app/utils/owner-ids";

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
  const [themeSettings, setThemeSettings] = useState<Record<ThemeType, { enabled: boolean }>>({
    christmas: { enabled: false },
    halloween: { enabled: false },
    easter: { enabled: false },
    sinterklaas: { enabled: false },
    newyear: { enabled: false },
    oldyear: { enabled: false },
  });
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [themeMessage, setThemeMessage] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [banSteamId, setBanSteamId] = useState("");
  const [banning, setBanning] = useState(false);
  const [banStatus, setBanStatus] = useState<{ steamId: string; banned: boolean } | null>(null);
  const [loadingBanStatus, setLoadingBanStatus] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [loadingTestMode, setLoadingTestMode] = useState(true);
  const [testModeMessage, setTestModeMessage] = useState<string | null>(null);
  const [testModeError, setTestModeError] = useState<string | null>(null);
  const [failedPurchases, setFailedPurchases] = useState<any[]>([]);
  const [loadingFailedPurchases, setLoadingFailedPurchases] = useState(true);
  const [fixSteamId, setFixSteamId] = useState("");
  const [userPurchases, setUserPurchases] = useState<any[]>([]);
  const [loadingUserPurchases, setLoadingUserPurchases] = useState(false);
  const [fixingPurchase, setFixingPurchase] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loadingUserCount, setLoadingUserCount] = useState(true);
  const [timeouts, setTimeouts] = useState<Array<{ steamId: string; timeoutUntil: string; minutesRemaining: number }>>([]);
  const [loadingTimeouts, setLoadingTimeouts] = useState(true);
  const [searchSteamId, setSearchSteamId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("steam_user");
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const userIsOwner = isOwner(user?.steamId);

  useEffect(() => {
    if (!userIsOwner) return;
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

    const loadThemes = async () => {
      setLoadingThemes(true);
      try {
        const res = await fetch("/api/admin/themes", {
          headers: {
            "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
          },
        });
        const data = await res.json();
        if (res.ok) {
          setThemeSettings(data);
        }
      } catch (e: any) {
        console.error("Failed to load themes:", e);
      } finally {
        setLoadingThemes(false);
      }
    };
    loadThemes();

    const loadPurchases = async () => {
      if (!userIsOwner) return;
      setLoadingPurchases(true);
      try {
        // Load ALL purchases (no steamId filter for admin view)
        const res = await fetch(`/api/admin/purchases`, {
          headers: {
            "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
          },
        });
        if (res.ok) {
          const data = await res.json();
          setPurchases(data.purchases || []);
        }
      } catch (e: any) {
        console.error("Failed to load purchases:", e);
      } finally {
        setLoadingPurchases(false);
      }
    };
    loadPurchases();

    const loadTestMode = async () => {
      if (!userIsOwner) return;
      setLoadingTestMode(true);
      try {
        const res = await fetch(`/api/admin/stripe-test-mode?steamId=${user?.steamId}`, {
          headers: {
            "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
          },
        });
        if (res.ok) {
          const data = await res.json();
          setTestMode(data.testMode === true);
        }
      } catch (e: any) {
        console.error("Failed to load test mode:", e);
      } finally {
        setLoadingTestMode(false);
      }
    };
    loadTestMode();

    const loadFailedPurchases = async () => {
      if (!userIsOwner) return;
      setLoadingFailedPurchases(true);
      try {
        // Load ALL failed purchases (no steamId filter for admin view)
        const res = await fetch(`/api/admin/failed-purchases`, {
          headers: {
            "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
          },
        });
        if (res.ok) {
          const data = await res.json();
          setFailedPurchases(data.failedPurchases || []);
        }
      } catch (e: any) {
        console.error("Failed to load failed purchases:", e);
      } finally {
        setLoadingFailedPurchases(false);
      }
    };
    loadFailedPurchases();

    const loadUserCount = async () => {
      if (!userIsOwner) return;
      setLoadingUserCount(true);
      try {
        const res = await fetch('/api/admin/user-count');
        if (res.ok) {
          const data = await res.json();
          setTotalUsers(data.totalUsers || 0);
        }
      } catch (e: any) {
        console.error('Failed to load user count:', e);
      } finally {
        setLoadingUserCount(false);
      }
    };
    loadUserCount();

    const loadTimeouts = async () => {
      if (!userIsOwner) return;
      setLoadingTimeouts(true);
      try {
        const res = await fetch(`/api/admin/timeouts?adminSteamId=${user?.steamId}`);
        if (res.ok) {
          const data = await res.json();
          setTimeouts(data.timeouts || []);
        }
      } catch (e: any) {
        console.error('Failed to load timeouts:', e);
      } finally {
        setLoadingTimeouts(false);
      }
    };
    loadTimeouts();
    
    // Refresh timeouts every 30 seconds
    const timeoutInterval = setInterval(loadTimeouts, 30000);
    return () => clearInterval(timeoutInterval);
  }, [userIsOwner, user?.steamId]);

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

  const handleThemeToggle = async (theme: ThemeType, enabled: boolean) => {
    setThemeMessage(null);
    setThemeError(null);
    
    try {
      const res = await fetch("/api/admin/themes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
        body: JSON.stringify({ theme, enabled }),
      });

      const data = await res.json();
      if (!res.ok) {
        setThemeError(data?.error || "Failed to update theme.");
      } else {
        setThemeSettings(data.settings);
        setThemeMessage(`${theme} theme ${enabled ? "enabled" : "disabled"}`);
        setTimeout(() => setThemeMessage(null), 3000);
        // Trigger theme update for all users
        window.dispatchEvent(new CustomEvent('themeChanged'));
      }
    } catch (e: any) {
      setThemeError(e?.message || "Request failed.");
    }
  };

  const themeLabels: Record<ThemeType, string> = {
    christmas: "Kerst (Christmas)",
    halloween: "Halloween",
    easter: "Pasen (Easter)",
    sinterklaas: "Sinterklaas",
    newyear: "Nieuwjaar (New Year)",
    oldyear: "Oudjaar (Old Year)",
  };

  const handleDeletePro = async (steamIdToDelete: string) => {
    if (!confirm(`Are you sure you want to remove Pro status for ${steamIdToDelete}?`)) return;
    
    try {
      const res = await fetch(`/api/admin/pro?steamId=${steamIdToDelete}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
      });

      if (res.ok) {
        setMessage(`Pro status removed for ${steamIdToDelete}`);
        // Refresh stats
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
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete Pro status");
      }
    } catch (e: any) {
      setError(e?.message || "Request failed.");
    }
  };

  const handleEditPro = async (steamIdToEdit: string, newDate: string) => {
    try {
      const res = await fetch("/api/admin/pro", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
        body: JSON.stringify({ steamId: steamIdToEdit, proUntil: newDate }),
      });

      if (res.ok) {
        setEditingEntry(null);
        setEditDate("");
        setMessage(`Pro status updated for ${steamIdToEdit}`);
        // Refresh stats
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
      } else {
        const data = await res.json();
        setError(data.error || "Failed to edit Pro status");
      }
    } catch (e: any) {
      setError(e?.message || "Request failed.");
    }
  };

  const handleTestModeToggle = async (enabled: boolean) => {
    setTestModeMessage(null);
    setTestModeError(null);
    
    try {
      const res = await fetch("/api/admin/stripe-test-mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
        body: JSON.stringify({ testMode: enabled }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestMode(enabled);
        setTestModeMessage(data.message || `Test mode ${enabled ? 'enabled' : 'disabled'}`);
        setTimeout(() => setTestModeMessage(null), 3000);
      } else {
        setTestModeError(data.error || "Failed to update test mode");
      }
    } catch (e: any) {
      setTestModeError(e?.message || "Request failed.");
    }
  };

  const handleCheckBanStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banSteamId || !/^\d{17}$/.test(banSteamId)) {
      setError("Invalid SteamID64 format");
      return;
    }

    setLoadingBanStatus(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/ban?steamId=${banSteamId}`, {
        headers: {
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
      });

      const data = await res.json();
      if (res.ok) {
        setBanStatus({ steamId: banSteamId, banned: data.banned === true });
      } else {
        setError(data.error || "Failed to check ban status");
      }
    } catch (e: any) {
      setError(e?.message || "Request failed.");
    } finally {
      setLoadingBanStatus(false);
    }
  };

  const handleBanUser = async () => {
    if (!banStatus?.steamId) return;

    setBanning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
        body: JSON.stringify({ steamId: banStatus.steamId }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Steam ID ${banStatus.steamId} has been banned`);
        setBanStatus({ steamId: banStatus.steamId, banned: true });
      } else {
        setError(data.error || "Failed to ban Steam ID");
      }
    } catch (e: any) {
      setError(e?.message || "Request failed.");
    } finally {
      setBanning(false);
    }
  };

  const handleUnbanUser = async () => {
    if (!banStatus?.steamId) return;

    setBanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ban?steamId=${banStatus.steamId}`, {
        method: "DELETE",
        headers: {
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Steam ID ${banStatus.steamId} has been unbanned`);
        setBanStatus({ steamId: banStatus.steamId, banned: false });
        
        // Clear the banned notification from localStorage if it exists
        try {
          if (typeof window !== 'undefined') {
            const stored = window.localStorage.getItem('sv_banned_notification');
            if (stored) {
              const notification = JSON.parse(stored);
              // If this is the same user, clear the notification
              if (notification.steamId === banStatus.steamId) {
                window.localStorage.removeItem('sv_banned_notification');
                // Trigger a storage event so other tabs/pages also clear it
                window.dispatchEvent(new StorageEvent('storage', {
                  key: 'sv_banned_notification',
                  oldValue: stored,
                  newValue: null,
                }));
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
      } else {
        setError(data.error || "Failed to unban Steam ID");
      }
    } catch (e: any) {
      setError(e?.message || "Request failed.");
    } finally {
      setBanning(false);
    }
  };

  const handleLoadUserPurchases = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixSteamId || !/^\d{17}$/.test(fixSteamId)) {
      setFixError("Invalid SteamID64 format");
      return;
    }

    setLoadingUserPurchases(true);
    setFixError(null);
    setFixMessage(null);
    setUserPurchases([]);

    try {
      const res = await fetch(`/api/admin/purchases?steamId=${fixSteamId}`, {
        headers: {
          "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        },
      });

      const data = await res.json();
      if (res.ok) {
        setUserPurchases(data.purchases || []);
        if (data.purchases?.length === 0) {
          setFixMessage("No purchases found for this user.");
        }
      } else {
        setFixError(data.error || "Failed to load purchases");
      }
    } catch (e: any) {
      setFixError(e?.message || "Request failed.");
    } finally {
      setLoadingUserPurchases(false);
    }
  };

  const handleFixPurchase = async (sessionId: string, steamId: string) => {
    setFixingPurchase(true);
    setFixError(null);
    setFixMessage(null);

    try {
      const res = await fetch("/api/payment/fix-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, steamId }),
      });

      const data = await res.json();
      if (res.ok) {
        setFixMessage(data.message || "Purchase fixed successfully!");
        // Reload user purchases
        const reloadRes = await fetch(`/api/admin/purchases?steamId=${steamId}`, {
          headers: {
            "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "",
          },
        });
        const reloadData = await reloadRes.json();
        if (reloadRes.ok) {
          setUserPurchases(reloadData.purchases || []);
        }
      } else {
        setFixError(data.error || "Failed to fix purchase");
      }
    } catch (e: any) {
      setFixError(e?.message || "Request failed.");
    } finally {
      setFixingPurchase(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">
              Admin
            </p>
            <p className="text-sm text-gray-400">
              Sign in with Steam first to access the admin panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!userIsOwner) {
    return (
      <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar flex items-center justify-center">
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
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 custom-scrollbar">
        <div className="w-full max-w-5xl mx-auto bg-[#11141d] border border-white/10 p-6 md:p-8 lg:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-6 md:space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="hidden md:inline-flex items-center gap-1 text-[9px] md:text-[10px] text-gray-500 hover:text-white uppercase tracking-[0.2em]"
            >
              <ArrowLeft size={12} /> Back
            </button>
            <div className="p-2 rounded-xl md:rounded-2xl bg-emerald-500/10 border border-emerald-500/40 shrink-0">
              <Shield className="text-emerald-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                Owner Console
              </p>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-black italic uppercase tracking-tighter">
                Pro Management
              </h1>
            </div>
          </div>
        </div>

        <p className="text-[10px] md:text-[11px] text-gray-400">
          Grant or extend <span className="text-emerald-400 font-bold">Pro</span>{" "}
          for any SteamID64. Pro automatically becomes inactive when the expiry
          date passes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 text-[10px] md:text-[11px]">
          <div className="bg-black/40 border border-blue-500/30 rounded-xl md:rounded-2xl p-3 md:p-4">
            <p className="text-blue-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
              Total Users
            </p>
            <p className="text-xl md:text-2xl font-black text-blue-400">
              {loadingUserCount ? <Loader2 className="animate-spin inline" size={20} /> : totalUsers}
            </p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4">
            <p className="text-gray-500 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
              Total Pro users
            </p>
            <p className="text-xl md:text-2xl font-black">{totals.total}</p>
          </div>
          <div className="bg-black/40 border border-emerald-500/30 rounded-xl md:rounded-2xl p-3 md:p-4">
            <p className="text-emerald-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
              Active
            </p>
            <p className="text-xl md:text-2xl font-black text-emerald-400">
              {totals.active}
            </p>
          </div>
          <div className="bg-black/40 border border-red-500/30 rounded-xl md:rounded-2xl p-3 md:p-4">
            <p className="text-red-400 uppercase font-black tracking-[0.3em] mb-1 text-[9px]">
              Expired
            </p>
            <p className="text-xl md:text-2xl font-black text-red-400">
              {totals.expired}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.1fr,1.5fr] gap-6 md:gap-8 items-start">
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px]">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">
              Grant / extend Pro
            </p>
            <div>
              <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                SteamID64
              </label>
              <input
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="7656119..."
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                Months to add
              </label>
              <input
                type="number"
                min={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
              {submitting ? "Saving..." : "Save Pro Status"}
            </button>

            {message && (
              <div className="mt-2 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
                <CheckCircle2 size={12} /> <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="mt-2 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
                <AlertTriangle size={12} /> <span>{error}</span>
              </div>
            )}
          </form>

          <div className="space-y-3 text-[10px] md:text-[11px]">
            <p className="font-black uppercase tracking-[0.3em] text-gray-500">
              Pro users dashboard
            </p>
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-64 md:max-h-72 overflow-y-auto">
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[9px] md:text-[10px] min-w-[400px]">
                    <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                      <tr>
                        <th className="py-2 pr-2">SteamID</th>
                        <th className="py-2 pr-2">Expires</th>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2 pr-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.steamId} className="border-b border-white/5 last:border-b-0">
                          <td className="py-2 pr-2 font-mono text-[9px] break-all">
                            {e.steamId}
                          </td>
                          <td className="py-2 pr-2 text-[9px]">
                            {editingEntry === e.steamId ? (
                              <input
                                type="datetime-local"
                                value={editDate}
                                onChange={(ev) => setEditDate(ev.target.value)}
                                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[9px] text-blue-500"
                              />
                            ) : (
                              <>
                            {new Date(e.proUntil).toLocaleDateString()}{" "}
                                {e.isActive && `(${e.daysRemaining}d)`}
                              </>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {e.isActive ? (
                              <span className="text-emerald-400 text-[9px]">Active</span>
                            ) : (
                              <span className="text-gray-500 text-[9px]">Expired</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-1">
                              {editingEntry === e.steamId ? (
                                <>
                                  <button
                                    onClick={() => handleEditPro(e.steamId, editDate || e.proUntil)}
                                    className="p-1 text-emerald-400 hover:text-emerald-300"
                                    title="Save"
                                  >
                                    <CheckCircle2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingEntry(null);
                                      setEditDate("");
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-300"
                                    title="Cancel"
                                  >
                                    <AlertTriangle size={12} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingEntry(e.steamId);
                                      setEditDate(new Date(e.proUntil).toISOString().slice(0, 16));
                                    }}
                                    className="p-1 text-blue-400 hover:text-blue-300"
                                    title="Edit"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePro(e.steamId)}
                                    className="p-1 text-red-400 hover:text-red-300"
                                    title="Delete"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Failed Purchases Section */}
        {failedPurchases.length > 0 && (
          <div className="mt-8 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl md:rounded-2xl bg-red-500/10 border border-red-500/40 shrink-0">
                <AlertTriangle className="text-red-400" size={16} />
              </div>
              <div>
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                  Failed Purchases
                </p>
                <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                  Needs Manual Review
                </h2>
              </div>
            </div>

            <p className="text-[10px] md:text-[11px] text-gray-400 mb-6">
              These purchases failed to fulfill automatically. Use the verify endpoint to manually fulfill them.
            </p>

            <div className="bg-red-500/10 border border-red-500/30 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-[9px] md:text-[10px]">
                <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                  <tr>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">SteamID</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Session ID</th>
                    <th className="py-2 pr-2">Error</th>
                    <th className="py-2 pr-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {failedPurchases.map((fp, idx) => (
                    <tr key={idx} className="border-b border-white/5 last:border-b-0">
                      <td className="py-2 pr-2 text-[9px]">
                        {new Date(fp.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 font-mono text-[9px] break-all">
                        {fp.steamId}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {fp.type === "pro" ? "👑 Pro" : "🎁 Consumable"}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        €{fp.amount?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 pr-2 font-mono text-[8px] break-all">
                        {fp.sessionId?.substring(0, 20)}...
                      </td>
                      <td className="py-2 pr-2 text-[9px] text-red-400">
                        {fp.error || "Unknown"}
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/payment/verify-purchase', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId: fp.sessionId, steamId: fp.steamId }),
                              });
                              const data = await res.json();
                              if (res.ok && data.fulfilled) {
                                setMessage(`Purchase fulfilled: ${data.message}`);
                                // Reload failed purchases
                                const reloadRes = await fetch(`/api/admin/failed-purchases`, {
                                  headers: { "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "" },
                                });
                                if (reloadRes.ok) {
                                  const reloadData = await reloadRes.json();
                                  setFailedPurchases(reloadData.failedPurchases || []);
                                }
                              } else {
                                setError(data.error || 'Failed to fulfill purchase');
                              }
                            } catch (e: any) {
                              setError(e?.message || "Request failed.");
                            }
                          }}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                          title="Fulfill Purchase"
                        >
                          <CheckCircle2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Purchase History Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
              <ShoppingBag className="text-blue-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                Purchase History
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                Recent Purchases
              </h2>
            </div>
          </div>

          {loadingPurchases ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading purchases...
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-gray-500 text-[11px]">No purchases yet.</div>
          ) : (
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-[9px] md:text-[10px]">
                <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                  <tr>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">SteamID</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.slice(0, 50).map((purchase, idx) => (
                    <tr key={idx} className="border-b border-white/5 last:border-b-0">
                      <td className="py-2 pr-2 text-[9px]">
                        {new Date(purchase.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 font-mono text-[9px] break-all">
                        {purchase.steamId}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.type === "pro" ? "👑 Pro" : "🎁 Consumable"}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.currency === "eur" ? "€" : "$"}
                        {purchase.amount?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.fulfilled !== false ? (
                          <span className="text-emerald-400">✅ Fulfilled</span>
                        ) : (
                          <span className="text-red-400">❌ Failed</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.type === "pro"
                          ? `${purchase.months} month${purchase.months > 1 ? "s" : ""}`
                          : `${purchase.quantity}x ${purchase.consumableType || "item"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Fix Purchase Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
              <CheckCircle2 className="text-blue-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                Purchase Management
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                Fix Purchase
              </h2>
            </div>
          </div>

          <p className="text-[10px] md:text-[11px] text-gray-400 mb-4">
            Enter a Steam ID to view their purchases and fix any that weren't fulfilled properly.
          </p>

          <form onSubmit={handleLoadUserPurchases} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px] mb-6">
            <div>
              <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                SteamID64
              </label>
              <input
                value={fixSteamId}
                onChange={(e) => setFixSteamId(e.target.value)}
                placeholder="7656119..."
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
              />
            </div>
            <button
              type="submit"
              disabled={loadingUserPurchases}
              className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingUserPurchases && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
              {loadingUserPurchases ? "Loading..." : "Load Purchases"}
            </button>
          </form>

          {fixMessage && (
            <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
              <CheckCircle2 size={12} /> <span>{fixMessage}</span>
            </div>
          )}
          {fixError && (
            <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
              <AlertTriangle size={12} /> <span>{fixError}</span>
            </div>
          )}

          {userPurchases.length > 0 && (
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-[9px] md:text-[10px]">
                <thead className="text-gray-500 uppercase tracking-[0.2em] border-b border-white/10">
                  <tr>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Details</th>
                    <th className="py-2 pr-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userPurchases.map((purchase, idx) => (
                    <tr key={idx} className="border-b border-white/5 last:border-b-0">
                      <td className="py-2 pr-2 text-[9px]">
                        {new Date(purchase.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.type === "pro" ? "👑 Pro" : "🎁 Consumable"}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.currency === "eur" ? "€" : "$"}
                        {purchase.amount?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.fulfilled !== false ? (
                          <span className="text-emerald-400">✅ Fulfilled</span>
                        ) : (
                          <span className="text-red-400">❌ Failed</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-[9px]">
                        {purchase.type === "pro"
                          ? `${purchase.months} month${purchase.months > 1 ? "s" : ""}`
                          : `${purchase.quantity}x ${purchase.consumableType || "item"}`}
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          onClick={() => handleFixPurchase(purchase.sessionId, purchase.steamId)}
                          disabled={fixingPurchase}
                          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-2 py-1 rounded text-[8px] font-black uppercase transition-all disabled:opacity-60 flex items-center gap-1"
                        >
                          {fixingPurchase ? (
                            <>
                              <Loader2 className="w-2 h-2 animate-spin" /> Fixing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={10} /> Fix
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ban Steam ID Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-red-500/10 border border-red-500/40 shrink-0">
              <Ban className="text-red-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                User Management
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                Ban Steam ID
              </h2>
            </div>
          </div>

          <p className="text-[10px] md:text-[11px] text-gray-400 mb-4">
            Enter a Steam ID to check their ban status and ban or unban them.
          </p>

          <form onSubmit={handleCheckBanStatus} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px] mb-6">
            <div>
              <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                SteamID64 to check
              </label>
              <input
                value={banSteamId}
                onChange={(e) => {
                  setBanSteamId(e.target.value);
                  setBanStatus(null); // Clear status when input changes
                }}
                placeholder="7656119..."
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-red-500 outline-none focus:border-red-500 transition-all placeholder:text-gray-700"
              />
            </div>
            <button
              type="submit"
              disabled={loadingBanStatus}
              className="w-full bg-red-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingBanStatus && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
              {loadingBanStatus ? "Checking..." : "Check Status"}
            </button>
          </form>

          {banStatus && (
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-gray-500">
                  Status for {banStatus.steamId}
                </p>
                <button
                  onClick={() => {
                    setBanStatus(null);
                    setBanSteamId("");
                  }}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] md:text-[11px] text-gray-400 mb-1">Ban Status:</p>
                  <p className={`text-[11px] md:text-[12px] font-black ${banStatus.banned ? 'text-red-400' : 'text-emerald-400'}`}>
                    {banStatus.banned ? '❌ Banned' : '✅ Not Banned'}
                  </p>
                </div>
              </div>
              {banStatus.banned ? (
                <button
                  onClick={handleUnbanUser}
                  disabled={banning}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {banning ? (
                    <>
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Unbanning...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} /> Unban User
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleBanUser}
                  disabled={banning}
                  className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl shadow-red-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {banning ? (
                    <>
                      <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> Banning...
                    </>
                  ) : (
                    <>
                      <Ban size={12} /> Ban User
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Reports Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-orange-500/10 border border-orange-500/40 shrink-0">
              <Flag className="text-orange-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                Moderation
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                Chat Reports
              </h2>
            </div>
          </div>
          <p className="text-[10px] md:text-[11px] text-gray-400 mb-4">
            View and manage user reports from global chat and DMs.
          </p>
          <button
            onClick={() => router.push('/admin/reports')}
            className="w-full bg-orange-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-orange-500 transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center gap-2"
          >
            <Flag size={14} /> View Reports
          </button>
        </div>

        {/* User Search Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/40 shrink-0">
              <Search className="text-blue-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                User Management
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                User Finder
              </h2>
            </div>
          </div>

          <p className="text-[10px] md:text-[11px] text-gray-400 mb-4">
            Search for a user by Steam ID to view their profile, chats, and manage their account.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); if (searchSteamId) router.push(`/admin/user/${searchSteamId}`); }} className="space-y-3 md:space-y-4 text-[10px] md:text-[11px] mb-6">
            <div>
              <label className="block text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">
                SteamID64
              </label>
              <input
                value={searchSteamId}
                onChange={(e) => setSearchSteamId(e.target.value)}
                placeholder="7656119..."
                className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-xs md:text-sm font-black text-blue-500 outline-none focus:border-blue-500 transition-all placeholder:text-gray-700"
              />
            </div>
            <button
              type="submit"
              disabled={!searchSteamId}
              className="w-full bg-blue-600 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Search size={14} /> Search User
            </button>
          </form>
        </div>

        {/* Timeout List Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-amber-500/10 border border-amber-500/40 shrink-0">
              <Clock className="text-amber-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                User Management
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                Active Timeouts
              </h2>
            </div>
          </div>

          {loadingTimeouts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-amber-400" size={24} />
            </div>
          ) : timeouts.length === 0 ? (
            <p className="text-[10px] md:text-[11px] text-gray-400">No active timeouts</p>
          ) : (
            <div className="space-y-2">
              {timeouts.map((timeout) => (
                <div key={timeout.steamId} className="bg-black/40 border border-amber-500/30 rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-[10px] md:text-[11px] font-black text-white mb-1">{timeout.steamId}</p>
                    <p className="text-[9px] md:text-[10px] text-gray-400">
                      {timeout.minutesRemaining} minute(s) remaining
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/admin/user/${timeout.steamId}`)}
                      className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors flex items-center gap-1"
                    >
                      <Search size={12} /> View
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/chat/timeout?steamId=${timeout.steamId}&adminSteamId=${user?.steamId}`, {
                            method: 'DELETE',
                          });
                          if (res.ok) {
                            setTimeouts(timeouts.filter(t => t.steamId !== timeout.steamId));
                          }
                        } catch (e) {
                          console.error('Failed to remove timeout:', e);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stripe Test Mode Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-yellow-500/10 border border-yellow-500/40 shrink-0">
              <Sparkles className="text-yellow-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                Payment Settings
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                Stripe Test Mode
              </h2>
            </div>
          </div>

          <p className="text-[10px] md:text-[11px] text-gray-400 mb-6">
            Enable test mode to use Stripe test keys (<code className="text-yellow-400">STRIPE_TEST_SECRET_KEY</code>) instead of production keys. 
            All payments will be marked as <span className="text-yellow-400 font-bold">[TEST]</span> and won't charge real money.
          </p>

          {testModeMessage && (
            <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
              <CheckCircle2 size={12} /> <span>{testModeMessage}</span>
            </div>
          )}
          {testModeError && (
            <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
              <AlertTriangle size={12} /> <span>{testModeError}</span>
            </div>
          )}

          {loadingTestMode ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading test mode status...
            </div>
          ) : (
            <div className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">
                  Test Mode
                </span>
                <p className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                  {testMode 
                    ? 'Using test keys (STRIPE_TEST_SECRET_KEY)' 
                    : 'Using production keys (STRIPE_SECRET_KEY)'}
                </p>
              </div>
              <button
                onClick={() => handleTestModeToggle(!testMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  testMode
                    ? "bg-yellow-600"
                    : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    testMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}

          {testMode && (
            <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl md:rounded-2xl p-4">
              <p className="text-[9px] md:text-[10px] text-yellow-400 font-bold mb-2">
                ⚠️ Test Mode Active
              </p>
              <ul className="text-[9px] md:text-[10px] text-gray-300 space-y-1">
                <li>• All payments will use test keys</li>
                <li>• Products will be marked with [TEST] prefix</li>
                <li>• Use test card: <code className="text-yellow-400">4242 4242 4242 4242</code></li>
                <li>• No real charges will be made</li>
                <li>• Make sure <code className="text-yellow-400">STRIPE_TEST_SECRET_KEY</code> is set in environment variables</li>
              </ul>
            </div>
          )}
        </div>

        {/* Theme Management Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl md:rounded-2xl bg-purple-500/10 border border-purple-500/40 shrink-0">
              <Sparkles className="text-purple-400" size={16} />
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">
                Theme Management
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-black italic uppercase tracking-tighter">
                Holiday Themes
              </h2>
            </div>
          </div>

          <p className="text-[10px] md:text-[11px] text-gray-400 mb-6">
            Enable or disable holiday themes. When enabled, themes are <span className="text-purple-400 font-bold">ON by default</span> for all users, but users can turn them off in their profile.
          </p>

          {themeMessage && (
            <div className="mb-4 flex items-center gap-2 text-emerald-400 text-[10px] md:text-[11px]">
              <CheckCircle2 size={12} /> <span>{themeMessage}</span>
            </div>
          )}
          {themeError && (
            <div className="mb-4 flex items-center gap-2 text-red-400 text-[10px] md:text-[11px]">
              <AlertTriangle size={12} /> <span>{themeError}</span>
            </div>
          )}

          {loadingThemes ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-[11px] py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading themes...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(themeLabels) as ThemeType[]).map((theme) => (
                <div
                  key={theme}
                  className="bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4 flex items-center justify-between"
                >
                  <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-gray-300">
                    {themeLabels[theme]}
                  </span>
                  <button
                    onClick={() => handleThemeToggle(theme, !themeSettings[theme]?.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      themeSettings[theme]?.enabled
                        ? "bg-purple-600"
                        : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        themeSettings[theme]?.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

