import { getDatabase } from '@/app/utils/mongodb-client';
import { OWNER_STEAM_IDS } from '@/app/utils/owner-ids';

export async function getProUntilMongoOnly(steamId: string): Promise<string | null> {
  const sid = String(steamId || '').trim();
  if (!/^\d{17}$/.test(sid)) return null;

  if ((OWNER_STEAM_IDS as any).includes(sid)) {
    return '2999-01-01T00:00:00.000Z';
  }

  const db = await getDatabase();
  const col = db.collection<{ _id: string; value: Record<string, string> }>('pro_users');
  const doc = await col.findOne({ _id: 'pro_users' }, { projection: { value: 1 } });
  const value = doc?.value && typeof doc.value === 'object' ? doc.value : null;
  const raw = value ? value[sid] : null;
  const proUntil = raw ? String(raw) : null;
  return proUntil || null;
}

export async function isProMongoOnly(steamId: string): Promise<boolean> {
  const proUntil = await getProUntilMongoOnly(steamId);
  if (!proUntil) return false;
  const d = new Date(proUntil);
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}
