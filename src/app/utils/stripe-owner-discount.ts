import Stripe from 'stripe';
import { dbGet, dbSet } from '@/app/utils/database';

export async function getOwnerFreeCouponId(stripe: Stripe, testMode: boolean): Promise<string | null> {
  try {
    const key = testMode ? 'stripe_owner_free_coupon_test' : 'stripe_owner_free_coupon_live';
    const existing = String((await dbGet<string>(key, false)) || '').trim();
    if (existing) {
      try {
        const coupon = await stripe.coupons.retrieve(existing);
        if (coupon && typeof coupon.id === 'string') return coupon.id;
      } catch {
      }
    }

    const created = await stripe.coupons.create({
      percent_off: 100,
      duration: 'once',
      name: testMode ? '[TEST] Owner 100% Discount' : 'Owner 100% Discount',
      metadata: {
        purpose: 'owner_free',
        mode: testMode ? 'test' : 'live',
      },
    });

    if (created?.id) {
      await dbSet(key, created.id);
      return created.id;
    }

    return null;
  } catch {
    return null;
  }
}
