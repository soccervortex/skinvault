import { notFound } from 'next/navigation';
import ItemDetailClient from './ItemDetailClient';

const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

// Server-side function to fetch item data for SEO and initial render
async function getItemData(itemId: string) {
  try {
    for (const file of API_FILES) {
      try {
        const response = await fetch(`${BASE_URL}/${file}`, { 
          next: { revalidate: 3600 } // Cache for 1 hour
        });
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        const item = items.find((i: any) => 
          i.id === itemId || 
          i.market_hash_name === itemId || 
          i.name === itemId
        );
        
        if (item) {
          return item;
        }
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    console.error('Failed to fetch item data:', error);
  }
  
  return null;
}

export default async function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  
  // Fetch item data server-side for SEO and initial render
  // This ensures Googlebot sees the content immediately
  const initialItem = await getItemData(decodedId);
  
  // If item not found, return proper 404 (not soft 404)
  if (!initialItem) {
    notFound();
  }
  
  // Pass initial data to client component
  // Client component will handle interactivity and price fetching
  return <ItemDetailClient initialItem={initialItem} itemId={id} />;
}
