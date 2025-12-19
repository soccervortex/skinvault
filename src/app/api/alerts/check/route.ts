import { NextResponse } from 'next/server';
import { checkPriceAlerts } from '@/app/services/discord-bot';

// Check price alerts for a specific item (called after price fetch)
// This endpoint is called internally by the price fetching system
export async function POST(request: Request) {
  try {
    const { marketHashName, currentPrice, currency } = await request.json();

    if (!marketHashName || currentPrice === undefined || !currency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check alerts and send notifications
    // currentPrice can be a number or string (Steam price format like "$1,234.56")
    await checkPriceAlerts(currentPrice, marketHashName, currency);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Check alerts error:', error);
    return NextResponse.json({ error: 'Failed to check alerts' }, { status: 500 });
  }
}

