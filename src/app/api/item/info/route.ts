import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { findBestMatch } from '@/app/utils/fuzzy-search';
import { API_FILES, BASE_URL } from '@/data/api-endpoints';

// Fetch with timeout helper
async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Get item info (image, name) by market_hash_name with fuzzy search
// OPTIMIZED: Parallel fetching with early exit for fast lookups
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const itemId = url.searchParams.get('id') || url.searchParams.get('market_hash_name');
    const useFuzzy = url.searchParams.get('fuzzy') !== 'false'; // Default to true

    if (!itemId) {
      return NextResponse.json({ error: 'Missing id or market_hash_name parameter' }, { status: 400 });
    }

    // First check custom items with optimized query
    try {
      const db = await getDatabase();
      // Use indexed query instead of fetching all items
      const customItem = await db.collection('custom_items').findOne({
        $or: [
          { id: itemId },
          { marketHashName: itemId },
          { name: itemId },
        ]
      });
      
      if (customItem) {
        return NextResponse.json({
          id: customItem.id,
          name: customItem.name,
          image: customItem.image || null,
          market_hash_name: customItem.marketHashName || customItem.name,
          rarity: customItem.rarity ? { name: customItem.rarity } : null,
          weapon: customItem.weapon ? { name: customItem.weapon } : null,
          isCustom: true,
        });
      }
    } catch (error) {
      // Continue to API check if custom items fail
    }

    // Fetch all API files in PARALLEL with early exit
    // This is much faster than sequential fetching
    const fetchPromises = API_FILES.map(async (file) => {
      try {
        const response = await fetchWithTimeout(`${BASE_URL}/${file}`, 5000);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        // Try exact match first (fastest)
        const item = items.find((i: any) => 
          i.id === itemId || 
          i.market_hash_name === itemId || 
          i.name === itemId
        );
        
        if (item) {
          return {
            name: item.name || item.market_hash_name || itemId,
            image: item.image || item.image_inventory || item.image_large || null,
            market_hash_name: item.market_hash_name || itemId,
            rarity: item.rarity,
            weapon: item.weapon,
            id: item.id,
            min_float: typeof item.min_float === 'number' ? item.min_float : (typeof item.minFloat === 'number' ? item.minFloat : null),
            max_float: typeof item.max_float === 'number' ? item.max_float : (typeof item.maxFloat === 'number' ? item.maxFloat : null),
            wear: item.wear || null,
            contains: Array.isArray(item.contains) ? item.contains : null,
            contains_rare: Array.isArray(item.contains_rare) ? item.contains_rare : null,
            crates: Array.isArray(item.crates) ? item.crates : null,
          };
        }
        
        return null;
      } catch (error) {
        return null;
      }
    });

    // Wait for first successful match (Promise.allSettled ensures all complete, but we check results)
    const results = await Promise.allSettled(fetchPromises);
    
    // Check results in order - first match wins
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return NextResponse.json(result.value);
      }
    }

    // If exact match not found and fuzzy search enabled, try fuzzy match
    if (useFuzzy) {
      // Re-fetch for fuzzy search (only if exact match failed)
      // This is slower but only runs when needed
      let allApiItems: any[] = [];
      const fuzzyPromises = API_FILES.map(async (file) => {
        try {
          const response = await fetchWithTimeout(`${BASE_URL}/${file}`, 5000);
          if (!response.ok) return [];
          const data = await response.json();
          return Array.isArray(data) ? data : Object.values(data);
        } catch {
          return [];
        }
      });
      
      const fuzzyResults = await Promise.allSettled(fuzzyPromises);
      fuzzyResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          allApiItems.push(...result.value);
        }
      });
      
      const match = findBestMatch(itemId, allApiItems.map((i: any) => ({
        name: i.market_hash_name || i.name,
        id: i.id,
        marketHashName: i.market_hash_name,
        ...i,
      })));
      
      if (match) {
        return NextResponse.json({
          name: match.name || match.market_hash_name || itemId,
          image: match.image || match.image_inventory || match.image_large || null,
          market_hash_name: match.market_hash_name || itemId,
          rarity: match.rarity,
          weapon: match.weapon,
          id: match.id,
          min_float: typeof (match as any).min_float === 'number' ? (match as any).min_float : (typeof (match as any).minFloat === 'number' ? (match as any).minFloat : null),
          max_float: typeof (match as any).max_float === 'number' ? (match as any).max_float : (typeof (match as any).maxFloat === 'number' ? (match as any).maxFloat : null),
          wear: (match as any).wear || null,
          contains: Array.isArray((match as any).contains) ? (match as any).contains : null,
          contains_rare: Array.isArray((match as any).contains_rare) ? (match as any).contains_rare : null,
          crates: Array.isArray((match as any).crates) ? (match as any).crates : null,
        });
      }
    }

    // If not found, return basic info with placeholder image
    return NextResponse.json({
      name: itemId,
      image: null,
      market_hash_name: itemId,
      id: itemId,
    });
  } catch (error) {
    console.error('Item info fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item info' },
      { status: 500 }
    );
  }
}
