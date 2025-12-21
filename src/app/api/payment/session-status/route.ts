import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

export async function GET(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if session is expired
    const isExpired = session.status === 'expired' || 
                     (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000));

    return NextResponse.json({ 
      expired: isExpired,
      status: session.status,
      expires_at: session.expires_at,
    });
  } catch (error: any) {
    console.error('Session status check error:', error);
    return NextResponse.json({ error: error.message || 'Failed to check session' }, { status: 500 });
  }
}

