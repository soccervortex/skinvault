"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';
import { isOwner } from '@/app/utils/owner-ids';
import { useToast } from '@/app/components/Toast';
import { AlertTriangle, ArrowLeft, Database, Loader2, RefreshCw, Server, Trash2, Wifi } from 'lucide-react';

type PendingCluster = {
  idx: number;
  envKey: string;
  host: string | null;
  createdAt: string;
  deployed?: boolean;
  deployedAt?: string;
};

type ConnectionInfo = {
  envKey: string;
  idx: number | null;
  configured: boolean;
  host: string | null;
  masked: string;
  active: boolean;
  inUse: boolean;
};

type StatusResponse = {
  dbName: string;
  mongodb: {
    configured: boolean;
    uriCandidatesCount: number;
    cachedUriHost: string | null;
    poolConnected: boolean;
    poolError: string | null;
  };
  integrations: {
    discordBotConfigured: boolean;
    discordClientIdConfigured: boolean;
    steamApiKeyConfigured: boolean;
  };
  connections: ConnectionInfo[];
  pending: PendingCluster[];
};

type MigrateChatCacheResponse = {
  success: boolean;
  summary?: {
    collections: number;
    remainingCollections: number;
    sourceDocs: number;
    upserted: number;
    modified: number;
    errors: number;
    dryRun: boolean;
  };
};

 type BackfillChatNamesResponse = {
  success: boolean;
  summary?: {
    dryRun: boolean;
    days: number;
    maxSteamIds: number;
    maxUpdates: number;
    includeChat: boolean;
    includeCore: boolean;
    collections: number;
    steamIds: number;
    matched: number;
    modified: number;
    skippedNoProfile: number;
    errors: number;
  };
 };

type TestResponse = {
  ok: boolean;
  host: string | null;
  masked: string;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
  stored: boolean;
  key: string | null;
};

type StatsResponse = {
  envKey: string;
  host: string | null;
  dbName: string;
  pingMs: number;
  stats: {
    db: string;
    collections: number | null;
    objects: number | null;
    avgObjSize: number | null;
    dataSize: number | null;
    storageSize: number | null;
    indexes: number | null;
    indexSize: number | null;
  };
  collections: string[];
};

export default function AdminDatabasesPage() {
  const router = useRouter();
  const toast = useToast();

  const [user, setUser] = useState<any>(null);
  const userIsOwner = useMemo(() => isOwner(user?.steamId), [user?.steamId]);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [liveRefreshEnabled, setLiveRefreshEnabled] = useState(true);
  const lastInteractAtRef = useRef<number>(0);

  const [selectedEnvKey, setSelectedEnvKey] = useState<string | null>(null);
  const [lastTest, setLastTest] = useState<TestResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [migrateSummary, setMigrateSummary] = useState<MigrateChatCacheResponse['summary'] | null>(null);

  const [backfillDays, setBackfillDays] = useState(14);
  const [backfillMaxUpdates, setBackfillMaxUpdates] = useState(5000);
  const [backfillIncludeChat, setBackfillIncludeChat] = useState(true);
  const [backfillIncludeCore, setBackfillIncludeCore] = useState(true);
  const [backfillSummary, setBackfillSummary] = useState<BackfillChatNamesResponse['summary'] | null>(null);

  const [addIdx, setAddIdx] = useState('');
  const [addUri, setAddUri] = useState('');
  const [applyTarget, setApplyTarget] = useState<'production' | 'preview' | 'development' | 'prod_preview'>('prod_preview');

  const suggestedNextIdx = useMemo(() => {
    try {
      const s = status;
      const idxs: number[] = [];

      for (const c of s?.connections || []) {
        if (typeof c?.idx === 'number' && Number.isFinite(c.idx) && c.idx >= 1) idxs.push(c.idx);
      }

      for (const p of s?.pending || []) {
        if (typeof p?.idx === 'number' && Number.isFinite(p.idx) && p.idx >= 1) idxs.push(p.idx);
      }

      const max = idxs.length ? Math.max(...idxs) : 0;
      return Math.max(1, max + 1);
    } catch {
      return 1;
    }
  }, [status]);

  const parseClusterIdxOrSuggested = () => {
    const raw = String(addIdx || '').trim();
    if (!raw) return suggestedNextIdx;
    if (!/^\d+$/.test(raw)) return null;
    const idx = Number.parseInt(raw, 10);
    if (!Number.isFinite(idx) || idx < 1) return null;
    return idx;
  };

  const [dangerEnvKey, setDangerEnvKey] = useState<string>('');
  const [dangerCollection, setDangerCollection] = useState('');
  const [dangerConfirm, setDangerConfirm] = useState('');
  const [dangerDbConfirm, setDangerDbConfirm] = useState('');

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('steam_user') : null;
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!userIsOwner) return;
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsOwner]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bump = () => {
      lastInteractAtRef.current = Date.now();
    };
    window.addEventListener('pointerdown', bump, true);
    window.addEventListener('keydown', bump, true);
    window.addEventListener('focusin', bump, true);
    return () => {
      window.removeEventListener('pointerdown', bump, true);
      window.removeEventListener('keydown', bump, true);
      window.removeEventListener('focusin', bump, true);
    };
  }, []);

  useEffect(() => {
    if (!userIsOwner) return;
    const interval = setInterval(() => {
      if (!liveRefreshEnabled) return;
      if (loadingAction) return;
      try {
        const active = document.activeElement as any;
        const tag = String(active?.tagName || '').toLowerCase();
        const isEditing = tag === 'input' || tag === 'textarea' || tag === 'select' || !!active?.isContentEditable;
        if (isEditing) return;
      } catch {
      }

      const last = lastInteractAtRef.current || 0;
      if (Date.now() - last < 2500) return;
      void loadStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [userIsOwner, loadingAction, liveRefreshEnabled]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mongo-manager/status', {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load status');
      setStatus(json);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load database status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const backfillChatNames = async (dryRun: boolean) => {
    setLoadingAction(dryRun ? 'backfill_dry' : 'backfill');
    setBackfillSummary(null);
    try {
      const res = await fetch('/api/admin/mongo-manager/backfill-chat-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun,
          days: backfillDays,
          maxUpdates: backfillMaxUpdates,
          includeChat: backfillIncludeChat,
          includeCore: backfillIncludeCore,
        }),
      });

      const json = (await res.json().catch(() => null)) as BackfillChatNamesResponse | null;
      if (!res.ok) throw new Error((json as any)?.error || 'Backfill failed');

      setBackfillSummary(json?.summary || null);
      toast.success(dryRun ? 'Dry run complete' : 'Backfill complete');
    } catch (e: any) {
      toast.error(e?.message || 'Backfill failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const migrateChatCache = async (dryRun: boolean) => {
    setLoadingAction(dryRun ? 'migrate_dry' : 'migrate');
    setMigrateSummary(null);
    try {
      const res = await fetch('/api/admin/mongo-manager/migrate-chat-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun,
          batchSize: 500,
          maxCollections: 40,
        }),
      });
      const json = (await res.json().catch(() => null)) as MigrateChatCacheResponse | null;
      if (!res.ok) throw new Error((json as any)?.error || 'Migration failed');

      setMigrateSummary(json?.summary || null);
      toast.success(dryRun ? 'Dry run complete' : 'Migration complete');
    } catch (e: any) {
      toast.error(e?.message || 'Migration failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const resetPool = async () => {
    setLoadingAction('reset');
    try {
      const res = await fetch('/api/admin/mongo-manager/reset', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success(json?.message || 'Pool reset');
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset pool');
    } finally {
      setLoadingAction(null);
    }
  };

  const runTest = async (envKey: string) => {
    setLoadingAction(`test:${envKey}`);
    setSelectedEnvKey(envKey);
    setLastTest(null);
    try {
      const res = await fetch('/api/admin/mongo-manager/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ envKey }),
      });
      const json = (await res.json()) as TestResponse;
      if (!res.ok) throw new Error((json as any)?.error || 'Failed');
      setLastTest(json);
      toast.success(json.ok ? 'Connection OK' : 'Connection failed');
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Test failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const loadStats = async (envKey: string) => {
    setLoadingAction(`stats:${envKey}`);
    setSelectedEnvKey(envKey);
    setStats(null);
    try {
      const res = await fetch('/api/admin/mongo-manager/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ envKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setStats(json as StatsResponse);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load stats');
    } finally {
      setLoadingAction(null);
    }
  };

  const addPending = async () => {
    const idx = parseClusterIdxOrSuggested();
    const uri = String(addUri || '').trim();

    if (!Number.isFinite(idx as any) || (idx as any) < 1 || !Number.isInteger(idx as any)) {
      toast.error('Enter a valid cluster number (>= 1)');
      return;
    }
    if (!uri) {
      toast.error('Enter a MongoDB URI');
      return;
    }

    setLoadingAction('add');
    try {
      const res = await fetch('/api/admin/mongo-manager/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idx, uri }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');

      toast.success(`Saved pending ${json?.pending?.envKey || ''}`);
      setAddIdx('');
      setAddUri('');
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add pending connection');
    } finally {
      setLoadingAction(null);
    }
  };

  const removePending = async (envKey: string) => {
    if (!envKey) return;
    setLoadingAction(`remove:${envKey}`);
    try {
      const res = await fetch(`/api/admin/mongo-manager/pending?envKey=${encodeURIComponent(envKey)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success(`Removed ${json?.removed || 0}`);
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove pending');
    } finally {
      setLoadingAction(null);
    }
  };

  const applyToVercel = async () => {
    const idx = parseClusterIdxOrSuggested();
    const uri = String(addUri || '').trim();

    if (!Number.isFinite(idx as any) || (idx as any) < 1 || !Number.isInteger(idx as any)) {
      toast.error('Enter a valid cluster number (>= 1)');
      return;
    }
    if (!uri) {
      toast.error('Enter a MongoDB URI');
      return;
    }

    setLoadingAction('vercel');
    try {
      const target = applyTarget === 'prod_preview' ? ['production', 'preview'] : [applyTarget];

      const res = await fetch('/api/admin/mongo-manager/vercel/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idx, uri, target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to apply to Vercel');

      const deployTriggered = !!json?.deploy?.triggered;
      const deployHookConfigured = !!json?.deploy?.hookConfigured;
      const deployError = json?.deploy?.error ? String(json.deploy.error) : null;

      if (deployHookConfigured && deployTriggered) {
        toast.success(`Applied ${json?.envKey || ''} and triggered deploy`);
      } else if (deployHookConfigured && deployError) {
        toast.success(`Applied ${json?.envKey || ''} (deploy hook failed)`);
      } else {
        toast.success(`Applied ${json?.envKey || ''} to Vercel`);
      }

      // Best-effort: store as pending so it appears until deployment picks it up.
      try {
        await fetch('/api/admin/mongo-manager/pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idx, uri }),
        });
      } catch {
        // ignore
      }

      setAddIdx('');
      setAddUri('');
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to apply to Vercel');
    } finally {
      setLoadingAction(null);
    }
  };

  const dropCollection = async () => {
    const envKey = String(dangerEnvKey || '').trim();
    const collection = String(dangerCollection || '').trim();
    const confirm = String(dangerConfirm || '').trim();

    if (!envKey) {
      toast.error('Select a connection');
      return;
    }
    if (!collection) {
      toast.error('Enter a collection name');
      return;
    }

    setLoadingAction('drop-collection');
    try {
      const res = await fetch('/api/admin/mongo-manager/danger/drop-collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ envKey, collection, confirm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success(json?.dropped ? 'Collection dropped' : 'Collection not found');
      setDangerCollection('');
      setDangerConfirm('');
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to drop collection');
    } finally {
      setLoadingAction(null);
    }
  };

  const dropDatabase = async () => {
    const envKey = String(dangerEnvKey || '').trim();
    const confirm = String(dangerDbConfirm || '').trim();

    if (!envKey) {
      toast.error('Select a connection');
      return;
    }

    setLoadingAction('drop-database');
    try {
      const res = await fetch('/api/admin/mongo-manager/danger/drop-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ envKey, confirm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      toast.success('Database dropped');
      setDangerDbConfirm('');
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to drop database');
    } finally {
      setLoadingAction(null);
    }
  };

  if (!userIsOwner) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-12 custom-scrollbar">
          <div className="w-full max-w-6xl mx-auto">
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white mb-6 md:mb-8 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Admin
            </button>

            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter">Database Manager</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLiveRefreshEnabled((v) => !v)}
                  disabled={loading || !!loadingAction}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-60"
                >
                  Live: {liveRefreshEnabled ? 'On' : 'Off'}
                </button>
                <button
                  onClick={loadStatus}
                  disabled={loading || !!loadingAction}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : !status ? (
              <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6 text-[11px] text-gray-400">
                Failed to load status.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30">
                        <Database className="text-blue-400" size={16} />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.4em] text-gray-500 font-black">MongoDB</div>
                        <div className="text-sm font-black">{status.mongodb.configured ? 'Configured' : 'Not configured'}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400">DB: {status.dbName}</div>
                    <div className="text-[10px] text-gray-400">Candidates: {status.mongodb.uriCandidatesCount}</div>
                  </div>

                  <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <Wifi className="text-emerald-400" size={16} />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.4em] text-gray-500 font-black">Pool</div>
                        <div className={`text-sm font-black ${status.mongodb.poolConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                          {status.mongodb.poolConnected ? 'Connected' : 'Disconnected'}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400">Active host: {status.mongodb.cachedUriHost || 'none'}</div>
                    {status.mongodb.poolError ? (
                      <div className="text-[10px] text-red-400 mt-2 break-words">{status.mongodb.poolError}</div>
                    ) : null}
                    <button
                      onClick={resetPool}
                      disabled={loadingAction === 'reset'}
                      className="mt-3 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loadingAction === 'reset' ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                      Reset pool
                    </button>
                  </div>

                  <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30">
                        <Server className="text-purple-400" size={16} />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.4em] text-gray-500 font-black">Pending deploy</div>
                        <div className="text-sm font-black">{status.pending.length}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Add new Mongo clusters by creating Vercel env vars.
                    </div>
                  </div>

                  <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <Server className="text-gray-300" size={16} />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.4em] text-gray-500 font-black">Integrations</div>
                        <div className="text-sm font-black">Status</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400">Discord bot: {status.integrations.discordBotConfigured ? 'Configured' : 'Missing'}</div>
                    <div className="text-[10px] text-gray-400">Discord client: {status.integrations.discordClientIdConfigured ? 'Configured' : 'Missing'}</div>
                    <div className="text-[10px] text-gray-400">Steam API key: {status.integrations.steamApiKeyConfigured ? 'Configured' : 'Missing'}</div>
                  </div>
                </div>

                <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6 mb-8">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Migrate chat/cache data</div>
                      <div className="text-sm font-black">Copy old collections to the chat/cache cluster</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => migrateChatCache(true)}
                        disabled={loadingAction === 'migrate_dry' || loadingAction === 'migrate'}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-60"
                      >
                        {loadingAction === 'migrate_dry' ? 'Running…' : 'Dry run'}
                      </button>
                      <button
                        onClick={() => migrateChatCache(false)}
                        disabled={loadingAction === 'migrate_dry' || loadingAction === 'migrate'}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-60"
                      >
                        {loadingAction === 'migrate' ? 'Migrating…' : 'Run migration'}
                      </button>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-400">
                    This copies chat/caches from the core cluster (Cluster 1) to the chat/cache cluster (Cluster 2+). It does not delete from the source.
                  </div>

                  {migrateSummary ? (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Collections</div>
                        <div className="text-sm font-black">{migrateSummary.collections}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Remaining</div>
                        <div className="text-sm font-black">{migrateSummary.remainingCollections}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Source docs</div>
                        <div className="text-sm font-black">{migrateSummary.sourceDocs}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Upserted</div>
                        <div className="text-sm font-black">{migrateSummary.upserted}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Modified</div>
                        <div className="text-sm font-black">{migrateSummary.modified}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Errors</div>
                        <div className={`text-sm font-black ${migrateSummary.errors ? 'text-red-400' : ''}`}>{migrateSummary.errors}</div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6 mb-8">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Backfill chat names/avatars</div>
                      <div className="text-sm font-black">Fix old "Unknown User" messages</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => backfillChatNames(true)}
                        disabled={loadingAction === 'backfill_dry' || loadingAction === 'backfill'}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-60"
                      >
                        {loadingAction === 'backfill_dry' ? 'Running…' : 'Dry run'}
                      </button>
                      <button
                        onClick={() => backfillChatNames(false)}
                        disabled={loadingAction === 'backfill_dry' || loadingAction === 'backfill'}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-60"
                      >
                        {loadingAction === 'backfill' ? 'Updating…' : 'Run backfill'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Days</div>
                      <input
                        value={backfillDays}
                        onChange={(e) => setBackfillDays(Number(e.target.value || 0))}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Max updates</div>
                      <input
                        value={backfillMaxUpdates}
                        onChange={(e) => setBackfillMaxUpdates(Number(e.target.value || 0))}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Targets</div>
                      <label className="flex items-center gap-2 text-[10px] text-gray-300 mb-2">
                        <input
                          type="checkbox"
                          checked={backfillIncludeChat}
                          onChange={(e) => setBackfillIncludeChat(e.target.checked)}
                        />
                        Chat cluster
                      </label>
                      <label className="flex items-center gap-2 text-[10px] text-gray-300">
                        <input
                          type="checkbox"
                          checked={backfillIncludeCore}
                          onChange={(e) => setBackfillIncludeCore(e.target.checked)}
                        />
                        Core cluster
                      </label>
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black mb-2">Notes</div>
                      <div className="text-[10px] text-gray-400">
                        Uses Steam Web API to fill missing names/avatars. Dry run is recommended first.
                      </div>
                    </div>
                  </div>

                  {backfillSummary ? (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Matched</div>
                        <div className="text-sm font-black">{backfillSummary.matched}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Modified</div>
                        <div className="text-sm font-black">{backfillSummary.modified}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">SteamIDs</div>
                        <div className="text-sm font-black">{backfillSummary.steamIds}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">No profile</div>
                        <div className="text-sm font-black">{backfillSummary.skippedNoProfile}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Errors</div>
                        <div className={`text-sm font-black ${backfillSummary.errors ? 'text-red-400' : ''}`}>{backfillSummary.errors}</div>
                      </div>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Dry run</div>
                        <div className="text-sm font-black">{backfillSummary.dryRun ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6 mb-8">
                  <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-3">Connections</div>
                  <div className="space-y-3">
                    {status.connections.map((c) => (
                      <div
                        key={c.envKey}
                        className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-black">{c.envKey}</div>
                            {c.inUse ? (
                              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400">
                                In use
                              </span>
                            ) : c.configured ? (
                              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400">
                                Available
                              </span>
                            ) : null}
                            {c.configured ? (
                              <span className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase text-blue-400">
                                Configured
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-lg bg-gray-500/10 border border-gray-500/20 text-[9px] font-black uppercase text-gray-400">
                                Missing
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 break-all">{c.masked}</div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <button
                            onClick={() => runTest(c.envKey)}
                            disabled={!c.configured || loadingAction === `test:${c.envKey}`}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-60 flex items-center gap-2"
                          >
                            {loadingAction === `test:${c.envKey}` ? <Loader2 className="animate-spin" size={14} /> : <Wifi size={14} />}
                            Test
                          </button>
                          <button
                            onClick={() => loadStats(c.envKey)}
                            disabled={!c.configured || loadingAction === `stats:${c.envKey}`}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-60 flex items-center gap-2"
                          >
                            {loadingAction === `stats:${c.envKey}` ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />}
                            Stats
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedEnvKey && (lastTest || stats) ? (
                    <div className="mt-6 bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-2">
                        Details: {selectedEnvKey}
                      </div>
                      {lastTest ? (
                        <div className="text-[11px] text-gray-300">
                          <div className={`font-black ${lastTest.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                            {lastTest.ok ? 'OK' : 'FAILED'}
                          </div>
                          <div className="text-[10px] text-gray-400">Host: {lastTest.host || 'unknown'}</div>
                          <div className="text-[10px] text-gray-400">Latency: {lastTest.latencyMs ?? 'n/a'} ms</div>
                          {lastTest.error ? <div className="text-[10px] text-red-400 break-words">{lastTest.error}</div> : null}
                        </div>
                      ) : null}

                      {stats ? (
                        <div className="mt-4 text-[11px] text-gray-300">
                          <div className="text-[10px] text-gray-400">Ping: {stats.pingMs} ms</div>
                          <div className="text-[10px] text-gray-400">Collections: {stats.stats.collections ?? 'n/a'}</div>
                          <div className="text-[10px] text-gray-400">Objects: {stats.stats.objects ?? 'n/a'}</div>
                          <div className="text-[10px] text-gray-400">Data size: {stats.stats.dataSize ?? 'n/a'}</div>
                          <div className="text-[10px] text-gray-400">Storage size: {stats.stats.storageSize ?? 'n/a'}</div>
                          <div className="text-[10px] text-gray-400">Indexes: {stats.stats.indexes ?? 'n/a'}</div>
                          <div className="text-[10px] text-gray-400">Index size: {stats.stats.indexSize ?? 'n/a'}</div>
                          <div className="mt-3 text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Collection names</div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {stats.collections.slice(0, 50).map((name) => (
                              <div key={name} className="text-[10px] text-gray-400 break-all bg-black/40 border border-white/5 rounded-xl px-3 py-2">
                                {name}
                              </div>
                            ))}
                          </div>
                          {stats.collections.length > 50 ? (
                            <div className="mt-2 text-[10px] text-gray-500">Showing first 50 collections</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6">
                  <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-3">Add Mongo connection (Vercel)</div>
                  <div className="text-[10px] text-gray-400 mb-4">
                    This does not change Vercel env vars automatically. It saves a "pending deploy" record and generates the env var name.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black mb-2">Cluster number</label>
                      <input
                        value={addIdx}
                        onChange={(e) => setAddIdx(e.target.value)}
                        placeholder={String(suggestedNextIdx)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black mb-2">Mongo URI</label>
                      <input
                        value={addUri}
                        onChange={(e) => setAddUri(e.target.value)}
                        placeholder="mongodb+srv://..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black mb-2">Vercel target</label>
                      <select
                        value={applyTarget}
                        onChange={(e) => setApplyTarget(e.target.value as any)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="prod_preview">production + preview</option>
                        <option value="production">production</option>
                        <option value="preview">preview</option>
                        <option value="development">development</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 text-[10px] text-gray-500 flex items-end">
                      Apply will upsert `MONGODB_CLUSTER_${String(addIdx || suggestedNextIdx || 'N')}` in your Vercel project and optionally trigger a redeploy hook.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={addPending}
                      disabled={loadingAction === 'add' || loadingAction === 'vercel'}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loadingAction === 'add' ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />}
                      Save pending
                    </button>
                    <button
                      onClick={applyToVercel}
                      disabled={loadingAction === 'add' || loadingAction === 'vercel'}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loadingAction === 'vercel' ? <Loader2 className="animate-spin" size={14} /> : <Server size={14} />}
                      Apply to Vercel
                    </button>
                  </div>

                  <div className="mt-6">
                    <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-2">Pending deploy list</div>
                    {status.pending.length === 0 ? (
                      <div className="text-[10px] text-gray-500">No pending connections.</div>
                    ) : (
                      <div className="space-y-2">
                        {status.pending.map((p) => (
                          <div key={p.envKey} className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-[11px] font-black">{p.envKey}</div>
                                {p.deployed ? (
                                  <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400">
                                    Deployed
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[9px] font-black uppercase text-yellow-400">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400">Host: {p.host || 'unknown'}</div>
                              <div className="text-[10px] text-gray-500">Created: {new Date(p.createdAt).toLocaleString()}</div>
                              {p.deployedAt ? (
                                <div className="text-[10px] text-gray-500">Detected: {new Date(p.deployedAt).toLocaleString()}</div>
                              ) : null}
                              <div className="mt-2 text-[10px] text-gray-400">
                                Set in Vercel as:
                                <div className="mt-1 text-white font-black break-all">{p.envKey}=YOUR_URI</div>
                              </div>
                            </div>
                            <button
                              onClick={() => removePending(p.envKey)}
                              disabled={loadingAction === `remove:${p.envKey}`}
                              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-60 flex items-center gap-2"
                            >
                              {loadingAction === `remove:${p.envKey}` ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 bg-[#11141d] border border-red-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30">
                      <AlertTriangle className="text-red-400" size={16} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black">Danger Zone</div>
                      <div className="text-sm font-black text-red-400">Destructive actions</div>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-400 mb-5">
                    These actions are irreversible. They run against the selected connection and the database name `{status.dbName}`.
                  </div>

                  <div className="mb-6">
                    <label className="block text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black mb-2">Target connection</label>
                    <select
                      value={dangerEnvKey}
                      onChange={(e) => setDangerEnvKey(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none focus:border-red-500 transition-all"
                    >
                      <option value="">Select connection</option>
                      {status.connections
                        .filter((c) => c.configured)
                        .map((c) => (
                          <option key={c.envKey} value={c.envKey}>
                            {c.envKey}{c.inUse ? ' (in use)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-3">Drop collection</div>
                      <label className="block text-[9px] uppercase tracking-[0.3em] text-gray-500 font-black mb-2">Collection name</label>
                      <input
                        value={dangerCollection}
                        onChange={(e) => setDangerCollection(e.target.value)}
                        placeholder="giveaway_claims"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none focus:border-red-500 transition-all"
                      />
                      <div className="mt-3 text-[10px] text-gray-400">Type exactly:</div>
                      <div className="mt-1 text-[10px] font-black text-white break-all">DROP COLLECTION {dangerCollection || '<name>'}</div>
                      <input
                        value={dangerConfirm}
                        onChange={(e) => setDangerConfirm(e.target.value)}
                        placeholder="DROP COLLECTION giveaway_claims"
                        className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none focus:border-red-500 transition-all"
                      />
                      <button
                        onClick={dropCollection}
                        disabled={loadingAction === 'drop-collection'}
                        className="mt-3 w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-red-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {loadingAction === 'drop-collection' ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                        Drop collection
                      </button>
                    </div>

                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-3">Drop database</div>
                      <div className="text-[10px] text-gray-400">Type exactly:</div>
                      <div className="mt-1 text-[10px] font-black text-white break-all">DROP DATABASE {status.dbName}</div>
                      <input
                        value={dangerDbConfirm}
                        onChange={(e) => setDangerDbConfirm(e.target.value)}
                        placeholder={`DROP DATABASE ${status.dbName}`}
                        className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none focus:border-red-500 transition-all"
                      />
                      <button
                        onClick={dropDatabase}
                        disabled={loadingAction === 'drop-database'}
                        className="mt-3 w-full bg-red-700 hover:bg-red-600 text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-red-700/20 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {loadingAction === 'drop-database' ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                        Drop database
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
