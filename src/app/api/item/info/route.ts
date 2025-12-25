import { NextResponse } from 'next/server';

// Get item info (image, name) by market_hash_name
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const marketHashName = url.searchParams.get('market_hash_name');

    if (!marketHashName) {
      return NextResponse.json({ error: 'Missing market_hash_name parameter' }, { status: 400 });
    }

    // Try to find item in dataset files
    const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
    
    for (const file of API_FILES) {
      try {
        const response = await fetch(`https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/scripts/items/${file}`, {
          cache: 'no-store',
        });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        
        // Search for item by market_hash_name
        const item = items.find((i: any) => 
          i.market_hash_name === marketHashName || 
          i.name === marketHashName ||
          i.id === marketHashName
        );
        
        if (item) {
          return NextResponse.json({
            name: item.name || marketHashName,
            image: item.image || item.image_inventory || item.image_large || null,
            market_hash_name: item.market_hash_name || marketHashName,
            rarity: item.rarity,
            weapon: item.weapon,
          });
        }
      } catch (error) {
        // Continue to next file
        continue;
      }
    }

    // If not found, return basic info with placeholder image
    return NextResponse.json({
      name: marketHashName,
      image: null,
      market_hash_name: marketHashName,
    });
  } catch (error) {
    console.error('Item info fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item info' },
      { status: 500 }
    );
  }
}


















