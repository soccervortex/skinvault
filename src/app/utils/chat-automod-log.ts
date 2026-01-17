import { dbGet, dbSet } from '@/app/utils/database';

export type ChatAutomodEvent = {
  id: string;
  at: string;
  channel: 'global' | 'dm';
  senderId: string;
  receiverId?: string | null;
  dmId?: string | null;
  reason: string;
  message: string;
};

const EVENTS_KEY = 'chat_automod_events';

function safeId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clip(value: string, max = 240): string {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function appendChatAutomodEvent(event: Omit<ChatAutomodEvent, 'id' | 'at'>): Promise<void> {
  try {
    const existing = (await dbGet<ChatAutomodEvent[]>(EVENTS_KEY, false)) || [];
    const next: ChatAutomodEvent[] = Array.isArray(existing) ? existing.slice(-199) : [];

    next.push({
      id: safeId(),
      at: new Date().toISOString(),
      channel: event.channel,
      senderId: String(event.senderId || ''),
      receiverId: event.receiverId ? String(event.receiverId) : null,
      dmId: event.dmId ? String(event.dmId) : null,
      reason: clip(event.reason || 'Blocked by automod', 200),
      message: clip(event.message || '', 240),
    });

    await dbSet(EVENTS_KEY, next);
  } catch {
  }
}

export async function getChatAutomodEvents(limit = 200): Promise<ChatAutomodEvent[]> {
  const existing = (await dbGet<ChatAutomodEvent[]>(EVENTS_KEY, false)) || [];
  const arr = Array.isArray(existing) ? existing : [];
  return arr.slice(Math.max(0, arr.length - Math.max(1, limit)));
}

export async function clearChatAutomodEvents(): Promise<void> {
  await dbSet(EVENTS_KEY, []);
}
