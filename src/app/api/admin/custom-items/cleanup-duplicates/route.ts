import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { dbDelete } from '@/app/utils/database';

/**
 * Cleanup custom items that now exist in the API
 * This should be run periodically (e.g., via cron job)
 */
export async function POST(request: Request) {
  try {
    const db = await getDatabase();
    const customItems = await db.collection('custom_items').find({}).toArray();
    
    const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    
    // Fetch all API items
    const apiItems: any[] = [];
    for (const file of API_FILES) {
      try {
        const response = await fetch(`${BASE_URL}/${file}`, { 
          next: { revalidate: 3600 }
        });
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        apiItems.push(...items);
      } catch (error) {
        continue;
      }
    }
    
    // Create a set of API item IDs and names for quick lookup
    const apiItemIds = new Set<string>();
    const apiItemNames = new Set<string>();
    
    apiItems.forEach((item: any) => {
      if (item.id) apiItemIds.add(item.id);
      if (item.market_hash_name) {
        apiItemIds.add(item.market_hash_name);
        apiItemNames.add(item.market_hash_name.toLowerCase());
      }
      if (item.name) {
        apiItemIds.add(item.name);
        apiItemNames.add(item.name.toLowerCase());
      }
    });
    
    // Check each custom item
    const deletedItems: string[] = [];
    for (const customItem of customItems) {
      const shouldDelete = 
        apiItemIds.has(customItem.id) ||
        apiItemIds.has(customItem.marketHashName) ||
        apiItemIds.has(customItem.name) ||
        apiItemNames.has(customItem.marketHashName?.toLowerCase() || '') ||
        apiItemNames.has(customItem.name?.toLowerCase() || '');
      
      if (shouldDelete) {
        await db.collection('custom_items').deleteOne({ id: customItem.id });
        await dbDelete(`custom_item:${customItem.id}`);
        deletedItems.push(customItem.id);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      deletedCount: deletedItems.length,
      deletedItems 
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup duplicates' },
      { status: 500 }
    );
  }
}

