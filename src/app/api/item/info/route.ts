import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { findBestMatch } from '@/app/utils/fuzzy-search';

// Get item info (image, name) by market_hash_name with fuzzy search
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const marketHashName = url.searchParams.get('market_hash_name');
    const useFuzzy = url.searchParams.get('fuzzy') !== 'false'; // Default to true

    if (!marketHashName) {
      return NextResponse.json({ error: 'Missing market_hash_name parameter' }, { status: 400 });
    }

    // First check custom items
    try {
      const db = await getDatabase();
      const customItems = await db.collection('custom_items').find({}).toArray();
      
      if (useFuzzy) {
        const match = findBestMatch(marketHashName, customItems.map((item: any) => ({
          name: item.name,
          id: item.id,
          marketHashName: item.marketHashName,
          ...item,
        })));
        
        if (match) {
          return NextResponse.json({
            name: match.name,
            image: match.image || null,
            market_hash_name: match.marketHashName || match.name,
            rarity: match.rarity ? { name: match.rarity } : null,
            weapon: match.weapon ? { name: match.weapon } : null,
            isCustom: true,
          });
        }
      } else {
        const customItem = customItems.find((item: any) => 
          item.id === marketHashName ||
          item.marketHashName === marketHashName ||
          item.name === marketHashName
        );
        
        if (customItem) {
          return NextResponse.json({
            name: customItem.name,
            image: customItem.image || null,
            market_hash_name: customItem.marketHashName || customItem.name,
            rarity: customItem.rarity ? { name: customItem.rarity } : null,
            weapon: customItem.weapon ? { name: customItem.weapon } : null,
            isCustom: true,
          });
        }
      }
    } catch (error) {
      // Continue to API check
    }

    // Try to find item in dataset files
    const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    
    let allApiItems: any[] = [];
    
    // Collect all items for fuzzy search
    for (const file of API_FILES) {
      try {
        const response = await fetch(`${BASE_URL}/${file}`, {
          next: { revalidate: 3600 }
        });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        allApiItems.push(...items);
      } catch (error) {
        continue;
      }
    }
    
    // Try exact match first
    let item = allApiItems.find((i: any) => 
      i.market_hash_name === marketHashName || 
      i.name === marketHashName ||
      i.id === marketHashName
    );
    
    // If not found and fuzzy search enabled, try fuzzy match
    if (!item && useFuzzy) {
      const match = findBestMatch(marketHashName, allApiItems.map((i: any) => ({
        name: i.market_hash_name || i.name,
        id: i.id,
        marketHashName: i.market_hash_name,
        ...i,
      })));
      
      if (match) {
        item = match;
      }
    }
    
    if (item) {
      return NextResponse.json({
        name: item.name || item.market_hash_name || marketHashName,
        image: item.image || item.image_inventory || item.image_large || null,
        market_hash_name: item.market_hash_name || marketHashName,
        rarity: item.rarity,
        weapon: item.weapon,
      });
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
