import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';

/**
 * Check if a custom item should be deleted because it now exists in the API
 * This should be called periodically to clean up custom items that are now in the main API
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, itemName } = body;

    if (!itemId && !itemName) {
      return NextResponse.json(
        { error: 'Missing itemId or itemName' },
        { status: 400 }
      );
    }

    // Check if item exists in API
    const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    
    for (const file of API_FILES) {
      try {
        const response = await fetch(`${BASE_URL}/${file}`, { 
          next: { revalidate: 3600 }
        });
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        const found = items.find((i: any) => 
          (itemId && (i.id === itemId || i.market_hash_name === itemId)) ||
          (itemName && (i.market_hash_name === itemName || i.name === itemName))
        );
        
        if (found) {
          // Item exists in API, should delete custom item
          const db = await getDatabase();
          const customItem = await db.collection('custom_items').findOne({
            $or: [
              { id: itemId },
              { id: itemName },
              { name: itemName },
              { marketHashName: itemName },
            ]
          });

          if (customItem) {
            return NextResponse.json({ 
              shouldDelete: true, 
              customItemId: customItem.id,
              foundInAPI: true 
            });
          }
        }
      } catch (error) {
        continue;
      }
    }

    return NextResponse.json({ shouldDelete: false, foundInAPI: false });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return NextResponse.json(
      { error: 'Failed to check duplicate' },
      { status: 500 }
    );
  }
}

