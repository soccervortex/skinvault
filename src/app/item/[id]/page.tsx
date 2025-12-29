import { notFound } from 'next/navigation';
import ItemDetailClient from './ItemDetailClient';

// Server-side function to fetch item data for SEO and initial render
// OPTIMIZED: Uses fast API endpoint instead of slow sequential file checking
async function getItemData(itemId: string) {
  try {
    // Use the optimized API endpoint which fetches in parallel
    // This is much faster than checking files sequentially
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://skinvaults.online';
    const apiUrl = `${baseUrl}/api/item/info?id=${encodeURIComponent(itemId)}&fuzzy=false`;
    
    const response = await fetch(apiUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    
    if (!response.ok) {
      return null;
    }
    
    const item = await response.json();
    
    // Return null if item not found (empty response)
    if (!item || (!item.name && !item.market_hash_name)) {
      return null;
    }
    
    return item;
  } catch (error) {
    console.error('Failed to fetch item data:', error);
    return null;
  }
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
