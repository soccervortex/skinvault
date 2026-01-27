import { sanitizeString } from '@/app/utils/sanitize';

export type ChatCommandDoc = {
  _id: string;
  slug: string;
  description?: string | null;
  response: string;
  enabled: boolean;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
};

export function normalizeChatCommandSlug(value: unknown): string | null {
  const raw = sanitizeString(String(value || '')).trim().toLowerCase();
  const cleaned = raw.replace(/^\/+/, '').slice(0, 32);
  if (!cleaned) return null;
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(cleaned)) return null;
  if (cleaned === 'ping') return null;
  return cleaned;
}

export function parseChatCommandInvocation(input: string): { slug: string; args: string } | null {
  const raw = String(input || '').trim();
  if (!raw.startsWith('/')) return null;
  const match = raw.match(/^\/([^\s]+)(?:\s+([\s\S]+))?$/);
  if (!match) return null;
  const slug = normalizeChatCommandSlug(match[1]);
  if (!slug) return null;
  const args = sanitizeString(String(match[2] || '')).trim().slice(0, 500);
  return { slug, args };
}

export function renderChatCommandResponse(template: string, vars: { userName: string; steamId: string; args: string }): string {
  const base = sanitizeString(String(template || '')).trim();
  const out = base
    .replace(/\{user\}/gi, sanitizeString(String(vars.userName || '')).trim())
    .replace(/\{steamid\}/gi, sanitizeString(String(vars.steamId || '')).trim())
    .replace(/\{args\}/gi, sanitizeString(String(vars.args || '')).trim());
  return out.trim().slice(0, 900);
}

export async function getEnabledChatCommandResponseTemplate(db: any, slug: string): Promise<string | null> {
  const s = normalizeChatCommandSlug(slug);
  if (!s) return null;
  const col = db.collection('chat_commands');
  const doc = await col.findOne({ _id: s, enabled: true, deleted: { $ne: true } } as any, {
    projection: { _id: 1, response: 1 },
  } as any);
  const resp = sanitizeString(String(doc?.response || '')).trim();
  return resp ? resp : null;
}

export async function listChatCommands(db: any, includeDeleted: boolean): Promise<ChatCommandDoc[]> {
  const col = db.collection('chat_commands');
  const query = includeDeleted ? {} : ({ deleted: { $ne: true } } as any);
  const rows = await col
    .find(query as any, { projection: { _id: 1, slug: 1, description: 1, response: 1, enabled: 1, deleted: 1, createdAt: 1, updatedAt: 1 } } as any)
    .sort({ updatedAt: -1 } as any)
    .limit(1000)
    .toArray();

  return (Array.isArray(rows) ? rows : []).map((r: any) => ({
    _id: String(r?._id || ''),
    slug: String(r?.slug || r?._id || ''),
    description: r?.description != null ? String(r.description) : null,
    response: String(r?.response || ''),
    enabled: r?.enabled === true,
    deleted: r?.deleted === true,
    createdAt: String(r?.createdAt || ''),
    updatedAt: String(r?.updatedAt || ''),
  }));
}
