export const CART_KEY = 'sv_cart_v1';
export const CART_ID_KEY = 'sv_cart_id';

let lastCartTrackAt = 0;

type AnyCartItem =
  | { kind: 'pro'; plan: string }
  | { kind: 'credits'; pack: string; quantity: number }
  | { kind: 'spins'; pack: string; quantity: number }
  | { kind: 'consumable'; consumableType: string; quantity: number };

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function readCart(): AnyCartItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as any) : [];
  } catch {
    return [];
  }
}

export function getCartItemCount(items?: AnyCartItem[]): number {
  const list = Array.isArray(items) ? items : [];
  let count = 0;
  for (const it of list) {
    const kind = String((it as any)?.kind || '').trim();
    if (kind === 'pro') {
      count += 1;
      continue;
    }
    if (kind === 'credits' || kind === 'spins') {
      count += clampInt(Number((it as any)?.quantity || 1), 1, 99);
      continue;
    }
    if (kind === 'consumable') {
      count += clampInt(Number((it as any)?.quantity || 1), 1, 100);
      continue;
    }
  }
  return count;
}

export function writeCart(items: AnyCartItem[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CART_KEY, JSON.stringify(Array.isArray(items) ? items : []));
    window.dispatchEvent(new CustomEvent('sv-cart-updated'));

    try {
      const now = Date.now();
      if (now - lastCartTrackAt < 750) return;
      lastCartTrackAt = now;

      const stored = window.localStorage.getItem('steam_user');
      const user = stored ? JSON.parse(stored) : null;
      const steamId = String(user?.steamId || '').trim();
      if (!/^\d{17}$/.test(steamId)) return;

      const cartId = getOrCreateCartId();

      void fetch('/api/discord/cart-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamId,
          cartId,
          items: Array.isArray(items) ? items : [],
          status: 'updated',
        }),
      });
    } catch {
    }
  } catch {
  }
}

export function getOrCreateCartId(): string {
  try {
    if (typeof window === 'undefined') return '';
    const existing = String(window.localStorage.getItem(CART_ID_KEY) || '').trim();
    if (existing) return existing;

    const id =
      typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(CART_ID_KEY, id);
    return id;
  } catch {
    return '';
  }
}

export function clearCartId(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(CART_ID_KEY);
  } catch {
  }
}

export function addToCart(item: AnyCartItem): { cart: AnyCartItem[]; count: number } {
  const next = readCart();
  const kind = String((item as any)?.kind || '').trim();

  if (kind === 'pro') {
    const plan = String((item as any)?.plan || '').trim();
    const updated: AnyCartItem[] = [{ kind: 'pro', plan }, ...next.filter((i) => String((i as any)?.kind || '') !== 'pro')];
    writeCart(updated);
    return { cart: updated, count: getCartItemCount(updated) };
  }

  if (kind === 'credits') {
    const pack = String((item as any)?.pack || '').trim();
    const addQty = clampInt(Number((item as any)?.quantity || 1), 1, 99);
    const existing = next.find((i) => String((i as any)?.kind || '') === 'credits' && String((i as any)?.pack || '') === pack) as any;
    if (existing) {
      existing.quantity = clampInt(Number(existing.quantity || 1) + addQty, 1, 99);
    } else {
      next.push({ kind: 'credits', pack, quantity: addQty } as any);
    }
    writeCart(next);
    return { cart: next, count: getCartItemCount(next) };
  }

  if (kind === 'spins') {
    const pack = String((item as any)?.pack || '').trim();
    const addQty = clampInt(Number((item as any)?.quantity || 1), 1, 99);
    const existing = next.find((i) => String((i as any)?.kind || '') === 'spins' && String((i as any)?.pack || '') === pack) as any;
    if (existing) {
      existing.quantity = clampInt(Number(existing.quantity || 1) + addQty, 1, 99);
    } else {
      next.push({ kind: 'spins', pack, quantity: addQty } as any);
    }
    writeCart(next);
    return { cart: next, count: getCartItemCount(next) };
  }

  if (kind === 'consumable') {
    const consumableType = String((item as any)?.consumableType || '').trim();
    const addQty = clampInt(Number((item as any)?.quantity || 1), 1, 100);
    const existing = next.find((i) => String((i as any)?.kind || '') === 'consumable' && String((i as any)?.consumableType || '') === consumableType) as any;
    if (existing) {
      existing.quantity = clampInt(Number(existing.quantity || 1) + addQty, 1, 100);
    } else {
      next.push({ kind: 'consumable', consumableType, quantity: addQty } as any);
    }
    writeCart(next);
    return { cart: next, count: getCartItemCount(next) };
  }

  return { cart: next, count: getCartItemCount(next) };
}
