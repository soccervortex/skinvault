import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { grantPro } from '@/app/utils/pro-storage';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const steamId = session.metadata?.steamId;
    const months = Number(session.metadata?.months || 0);
    const type = session.metadata?.type;

    // Handle Pro subscription
    if (steamId && months > 0 && type !== 'consumable') {
      try {
        const proUntil = await grantPro(steamId, months);
        console.log(`✅ Granted ${months} months Pro to ${steamId}, expires ${proUntil}`);
      } catch (error) {
        console.error('❌ Failed to update Pro status:', error);
        // Still return 200 to prevent Stripe from retrying
      }
    }

    // Handle consumables (price tracker slots, wishlist slots)
    if (steamId && type === 'consumable') {
      const consumableType = session.metadata?.consumableType;
      const quantity = Number(session.metadata?.quantity || 0);

      if (consumableType && quantity > 0) {
        try {
          // Grant consumable rewards
          const { kv } = await import('@vercel/kv');
          const rewardsKey = 'user_rewards';
          
          const existingRewards = await kv.get<Record<string, any[]>>(rewardsKey) || {};
          const userRewards = existingRewards[steamId] || [];

          // Add consumable rewards
          for (let i = 0; i < quantity; i++) {
            userRewards.push({
              type: consumableType,
              grantedAt: new Date().toISOString(),
              source: 'purchase',
            });
          }

          existingRewards[steamId] = userRewards;
          await kv.set(rewardsKey, existingRewards);

          console.log(`✅ Granted ${quantity} ${consumableType} to ${steamId}`);
        } catch (error) {
          console.error('❌ Failed to grant consumables:', error);
          // Still return 200 to prevent Stripe from retrying
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
