import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCachedMongoUri, getMongoClient, getMongoUriCandidates, hasMongoConfig } from '@/app/utils/mongodb-client';
import { dbGet, dbSet } from '@/app/utils/database';
import { isOwnerRequest } from '@/app/utils/admin-auth';

const PENDING_KEY = 'admin_pending_mongo_clusters';

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

function safeHostFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function maskMongoUri(uri: string): string {
  const host = safeHostFromUri(uri);
  if (!host) return 'mongodb://***';
  return `mongodb://***@${host}/***`;
}

function buildConnections(): ConnectionInfo[] {
  const activeUri = getCachedMongoUri();

  const clusterEntries = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('MONGODB_CLUSTER_') && value && String(value).trim())
    .map(([key, value]) => {
      const rawIdx = key.slice('MONGODB_CLUSTER_'.length);
      const idx = Number.parseInt(rawIdx, 10);
      return {
        key,
        idx: Number.isFinite(idx) ? idx : Number.POSITIVE_INFINITY,
        uri: String(value).trim(),
      };
    })
    .sort((a, b) => {
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.key.localeCompare(b.key);
    });

  const out: ConnectionInfo[] = [];
  const seenUris = new Set<string>();
  for (const entry of clusterEntries) {
    seenUris.add(entry.uri);
    const inUse = !!activeUri && activeUri === entry.uri;
    out.push({
      envKey: entry.key,
      idx: Number.isFinite(entry.idx) ? entry.idx : null,
      configured: true,
      host: safeHostFromUri(entry.uri),
      masked: maskMongoUri(entry.uri),
      active: inUse,
      inUse,
    });
  }

  const fallbackUri = process.env.MONGODB_URI ? String(process.env.MONGODB_URI).trim() : '';
  if (fallbackUri && !seenUris.has(fallbackUri)) {
    const inUse = !!activeUri && activeUri === fallbackUri;
    out.push({
      envKey: 'MONGODB_URI',
      idx: null,
      configured: true,
      host: safeHostFromUri(fallbackUri),
      masked: maskMongoUri(fallbackUri),
      active: inUse,
      inUse,
    });
  }

  // If nothing is configured, still show a placeholder entry for MONGODB_URI
  if (!out.length) {
    out.push({
      envKey: 'MONGODB_URI',
      idx: null,
      configured: false,
      host: null,
      masked: 'not configured',
      active: false,
      inUse: false,
    });
  }

  return out;
}

export async function GET(request: NextRequest) {
  if (!isOwnerRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbName = String(process.env.MONGODB_DB_NAME || 'skinvault');

  let pending = (await dbGet<PendingCluster[]>(PENDING_KEY, false)) || [];
  if (!Array.isArray(pending)) pending = [];

  // Update pending entries with deployed status (if env var exists now).
  let changed = false;
  const nowIso = new Date().toISOString();
  pending = pending.map((p) => {
    const envVal = (process.env as any)?.[p.envKey];
    const isDeployed = !!(envVal && String(envVal).trim());
    if (isDeployed && !p.deployed) {
      changed = true;
      return { ...p, deployed: true, deployedAt: nowIso };
    }
    return { ...p, deployed: !!p.deployed };
  });

  if (changed) {
    const ok = await dbSet(PENDING_KEY, pending);
    if (!ok) {
      // If storage isn't available, don't fail status endpoint.
      // The UI will still show the updated computed state.
    }
  }

  const connections = buildConnections();

  let poolConnected = false;
  let poolError: string | null = null;
  try {
    if (hasMongoConfig()) {
      const client = await getMongoClient();
      await client.db('admin').command({ ping: 1 });
      poolConnected = true;
    }
  } catch (e: any) {
    poolConnected = false;
    poolError = e?.message || String(e);
  }

  return NextResponse.json({
    dbName,
    mongodb: {
      configured: hasMongoConfig(),
      uriCandidatesCount: getMongoUriCandidates().length,
      cachedUriHost: getCachedMongoUri() ? safeHostFromUri(getCachedMongoUri() as string) : null,
      poolConnected,
      poolError,
    },
    integrations: {
      discordBotConfigured: !!(process.env.DISCORD_BOT_TOKEN && String(process.env.DISCORD_BOT_TOKEN).trim()),
      discordClientIdConfigured: !!(process.env.DISCORD_CLIENT_ID && String(process.env.DISCORD_CLIENT_ID).trim()),
      steamApiKeyConfigured: !!(process.env.STEAM_API_KEY && String(process.env.STEAM_API_KEY).trim()),
    },
    connections,
    pending,
  });
}
