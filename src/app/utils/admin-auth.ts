import type { NextRequest } from 'next/server';

import { isOwner } from '@/app/utils/owner-ids';
import { getSteamIdFromRequest } from '@/app/utils/steam-session';

const ADMIN_HEADER = 'x-admin-key';

export function isAdminRequest(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PRO_TOKEN;
  const adminKey = req.headers.get(ADMIN_HEADER);
  if (expected && adminKey === expected) return true;

  const steamId = getSteamIdFromRequest(req);
  return !!steamId && isOwner(steamId);
}

export function getAdminSteamId(req: NextRequest): string | null {
  const steamId = getSteamIdFromRequest(req);
  if (!steamId) return null;
  return isOwner(steamId) ? steamId : null;
}
