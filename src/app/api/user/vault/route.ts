import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// API endpoint for Discord bot to get user vault/inventory stats
// Returns total vault value and item count, always returns 0 for empty inventories (never infinity)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steamId');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing steamId' }, { status: 400 });
    }

    // Fetch inventory from Steam API
    const inventoryResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.vercel.app'}/api/steam/inventory?steamId=${steamId}`,
      { cache: 'no-store' }
    );

    if (!inventoryResponse.ok) {
      // If inventory fetch fails or is private, return 0 values (not infinity)
      return NextResponse.json({
        steamId,
        totalValue: 0,
        totalItems: 0,
        pricedItems: 0,
        currency: 'EUR',
        error: 'Inventory not accessible or empty'
      });
    }

    const inventoryData = await inventoryResponse.json();
    
    // Check if inventory is private or empty
    if (!inventoryData.success || !inventoryData.descriptions || !Array.isArray(inventoryData.descriptions) || inventoryData.descriptions.length === 0) {
      return NextResponse.json({
        steamId,
        totalValue: 0,
        totalItems: 0,
        pricedItems: 0,
        currency: 'EUR',
        error: inventoryData.error || 'Inventory is empty or private'
      });
    }

    // Count total items
    const assets = inventoryData.assets || [];
    const totalItems = assets.reduce((sum: number, asset: any) => sum + (asset.amount || 1), 0);

    // For now, we can't calculate prices server-side easily without making many API calls
    // So we return item count and let the bot handle price calculation if needed
    // Or we could return the inventory data and let the bot calculate
    
    // Return safe values - never return Infinity
    return NextResponse.json({
      steamId,
      totalValue: 0, // Will be calculated by bot if needed
      totalItems: totalItems || 0,
      pricedItems: 0, // Will be calculated by bot if needed
      currency: 'EUR',
      itemCount: totalItems || 0,
      hasItems: totalItems > 0
    });

  } catch (error) {
    console.error('Vault stats API error:', error);
    // Always return 0 values on error, never infinity
    return NextResponse.json({
      error: 'Failed to fetch vault stats',
      totalValue: 0,
      totalItems: 0,
      pricedItems: 0,
      currency: 'EUR'
    }, { status: 500 });
  }
}

