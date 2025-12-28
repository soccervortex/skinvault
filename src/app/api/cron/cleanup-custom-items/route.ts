import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { dbDelete } from '@/app/utils/database';
import { API_FILES, BASE_URL } from '@/data/api-endpoints';

/**
 * Cron job to cleanup custom items that now exist in the API
 * Should be called periodically (e.g., daily)
 */
export async function GET(request: Request) {
  try {
    // Verify it's a cron request (optional security check)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const customItems = await db.collection('custom_items').find({}).toArray();
    
    if (customItems.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0, message: 'No custom items to check' });
    }

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
    
    // Create sets for quick lookup
    const apiItemIds = new Set<string>();
    const apiItemNames = new Set<string>();
    
    apiItems.forEach((item: any) => {
      if (item.id) {
        apiItemIds.add(item.id);
        apiItemIds.add(String(item.id));
      }
      if (item.market_hash_name) {
        apiItemIds.add(item.market_hash_name);
        apiItemNames.add(item.market_hash_name.toLowerCase().trim());
      }
      if (item.name) {
        apiItemIds.add(item.name);
        apiItemNames.add(item.name.toLowerCase().trim());
      }
    });
    
    // Check each custom item
    const deletedItems: string[] = [];
    for (const customItem of customItems) {
      const customId = customItem.id?.toString() || '';
      const customName = (customItem.marketHashName || customItem.name || '').toLowerCase().trim();
      
      const shouldDelete = 
        apiItemIds.has(customId) ||
        apiItemIds.has(customItem.marketHashName || '') ||
        apiItemIds.has(customItem.name || '') ||
        apiItemNames.has(customName) ||
        apiItemNames.has((customItem.name || '').toLowerCase().trim());
      
      if (shouldDelete) {
        await db.collection('custom_items').deleteOne({ id: customItem.id });
        await dbDelete(`custom_item:${customItem.id}`);
        deletedItems.push(customItem.id);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      deletedCount: deletedItems.length,
      deletedItems,
      totalChecked: customItems.length
    });
  } catch (error) {
    console.error('Error cleaning up custom items:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup custom items' },
      { status: 500 }
    );
  }
}

