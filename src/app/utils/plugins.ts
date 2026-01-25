import type { Db } from 'mongodb';

export type PluginType = 'tawkto' | 'external_script' | 'inline_script';

export type PluginDoc = {
  _id: string;
  slug: string;
  name: string;
  type: PluginType;
  enabled: boolean;
  deleted?: boolean;
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function normalizePluginSlug(value: unknown): string | null {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug) return null;
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(slug)) return null;
  return slug;
}

export async function ensureDefaultPlugins(db: Db): Promise<void> {
  const col = db.collection('plugins');
  const now = nowIso();

  await col.updateOne(
    { _id: 'tawk' } as any,
    {
      $setOnInsert: {
        _id: 'tawk',
        slug: 'tawk',
        name: 'Tawk.to',
        type: 'tawkto',
        enabled: true,
        deleted: false,
        config: {
          embedUrl: 'https://embed.tawk.to/69757cfbdcaf61197c394bfd/1jfpf0dpc',
        },
        createdAt: now,
        updatedAt: now,
      },
    } as any,
    { upsert: true }
  );
}

export async function listPlugins(db: Db, includeDeleted: boolean = false): Promise<PluginDoc[]> {
  await ensureDefaultPlugins(db);
  const col = db.collection('plugins');
  const query = includeDeleted ? {} : { deleted: { $ne: true } };
  const docs = await col.find(query as any).sort({ name: 1 }).toArray();
  return (docs || []).map((d: any) => ({
    _id: String(d?._id || ''),
    slug: String(d?.slug || d?._id || ''),
    name: String(d?.name || d?._id || ''),
    type: (d?.type as PluginType) || 'external_script',
    enabled: !!d?.enabled,
    deleted: d?.deleted === true,
    config: (d?.config && typeof d.config === 'object') ? d.config : undefined,
    createdAt: String(d?.createdAt || ''),
    updatedAt: String(d?.updatedAt || ''),
  }));
}

export async function getEnabledPlugins(db: Db): Promise<PluginDoc[]> {
  const all = await listPlugins(db, false);
  return all.filter((p) => p.enabled);
}
