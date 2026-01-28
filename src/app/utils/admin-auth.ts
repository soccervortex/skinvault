import type { NextRequest } from 'next/server';

import { isOwner } from '@/app/utils/owner-ids';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';

export function isOwnerRequest(req: NextRequest): boolean {
  const steamId = getSteamIdFromRequest(req);
  return !!steamId && isOwner(steamId);
}

export function isAdminRequest(req: NextRequest): boolean {
  const steamId = getSteamIdFromRequest(req);
  return !!steamId && isOwner(steamId);
}

export function getAdminSteamId(req: NextRequest): string | null {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return null;
  return isOwner(steamId) ? steamId : null;
}

export type AdminAccess = {
  steamId: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  via: 'owner' | 'admin_user' | 'none';
  permissions: string[];
};

function normalizePermission(value: unknown): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.length > 64) return null;
  if (!/^[a-z0-9_*.-]+$/.test(raw)) return null;
  return raw;
}

export function hasAdminPermission(access: AdminAccess, permission: string): boolean {
  if (access.via === 'owner') return true;
  const p = normalizePermission(permission);
  if (!p) return false;
  return access.permissions.includes('*') || access.permissions.includes(p);
}

export async function getAdminAccess(req: NextRequest): Promise<AdminAccess> {
  const steamId = getSteamIdFromRequest(req);
  if (steamId && isOwner(steamId)) {
    return { steamId, isAdmin: true, isOwner: true, via: 'owner', permissions: ['*'] };
  }

  if (!steamId) {
    return { steamId: null, isAdmin: false, isOwner: false, via: 'none', permissions: [] };
  }

  try {
    if (!hasMongoConfig()) {
      return { steamId, isAdmin: false, isOwner: false, via: 'none', permissions: [] };
    }

    const db = await getDatabase();
    const col = db.collection('admin_users');
    const doc = await col.findOne({ _id: steamId, enabled: true } as any, { projection: { _id: 1, permissions: 1 } } as any);
    const permsRaw = Array.isArray((doc as any)?.permissions) ? (doc as any).permissions : [];
    const perms = permsRaw
      .map((x: any) => normalizePermission(x))
      .filter(Boolean) as string[];
    const uniq = Array.from(new Set(perms)).slice(0, 64);

    if (uniq.length === 0) {
      return { steamId, isAdmin: false, isOwner: false, via: 'none', permissions: [] };
    }

    return { steamId, isAdmin: true, isOwner: false, via: 'admin_user', permissions: uniq };
  } catch {
    return { steamId, isAdmin: false, isOwner: false, via: 'none', permissions: [] };
  }
}
