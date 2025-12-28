import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllItems, generateSlug } from '@/data/weapons';

// This is just a helper to make the "ak47-slate" look like "AK47 Slate"
const formatName = (slug: string) => slug.replace(/-/g, ' ').toUpperCase();

type Props = {
  params: { slug: string };
};

/**
 * THE SEO BRAIN FOR THIS PAGE
 * This tells Google: "This page is about this specific skin!"
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const allItems = await getAllItems();
  const weapon = allItems.find(w => w.slug === slug);
  
  if (!weapon) {
    return {
      title: 'Skin Not Found',
    };
  }

  const displayName = weapon.name;

  return {
    title: `${displayName} - Price Tracker & History`,
    description: `Real-time market data, price history, and analytics for ${displayName}. Track your investment safely on SkinVaults.`,
    openGraph: {
      title: `${displayName} | SkinVaults Analytics`,
      description: `Check the latest value of ${displayName}.`,
      // If you have skin images, you can link them here:
      // images: [`https://api.skinvaults.online/images/${slug}.jpg`],
    },
  };
}

/**
 * THE VISUAL PAGE
 * This is what the user actually sees.
 */
export default async function SkinPage({ params }: Props) {
  const { slug } = params;

  // Fetch all items and find the weapon by slug
  const allItems = await getAllItems();
  const weapon = allItems.find(w => w.slug === slug);

  // If the weapon doesn't exist, show a 404 error
  if (!weapon) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto p-10">
      <h1 className="text-4xl font-bold mb-4">{weapon.name}</h1>
      <div className="bg-gray-900 p-6 rounded-xl border border-blue-500/30">
        <p className="text-gray-400">Analytics Dashboard for {weapon.name}</p>
        
        <div className="mt-10 h-64 bg-black/50 rounded flex items-center justify-center border border-dashed border-gray-700">
          <p className="text-gray-500"> [ Your Price Chart Component Goes Here ] </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="p-4 bg-gray-800 rounded">
            <span className="block text-sm text-gray-500">Current Price</span>
            <span className="text-xl font-bold text-green-400">$??.??</span>
          </div>
          <div className="p-4 bg-gray-800 rounded">
            <span className="block text-sm text-gray-500">7-Day Trend</span>
            <span className="text-xl font-bold text-blue-400">+2.4%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
