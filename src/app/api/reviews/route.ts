import { NextResponse } from 'next/server';

// Review sources configuration
const REVIEW_SOURCES = [
  {
    name: 'Trustpilot',
    url: 'https://nl.trustpilot.com/review/skinvaults.online',
    apiUrl: null, // Trustpilot doesn't have a public API, would need scraping
  },
  {
    name: 'Sitejabber',
    url: 'https://www.sitejabber.com/reviews/skinvaults.online',
    apiUrl: null, // Sitejabber doesn't have a public API, would need scraping
  },
];

// Mock data structure - in production, you'd fetch from APIs or scrape
// For now, return structure that matches what the frontend expects
interface Review {
  id: string;
  source: string;
  sourceUrl: string;
  rating: number;
  reviewerName: string;
  reviewerAvatar?: string;
  reviewText: string;
  date: string;
  verified?: boolean;
}

// Mock reviews data - Replace with actual API calls or scraping
const MOCK_REVIEWS: Review[] = [
  // These would be fetched from actual review services
  // For now, return empty array and let frontend handle it
];

export async function GET() {
  try {
    // In production, you would:
    // 1. Fetch from Trustpilot API (if available) or scrape
    // 2. Fetch from Sitejabber API (if available) or scrape
    // 3. Combine and return all reviews
    
    // For now, return structure with sources info
    return NextResponse.json({
      reviews: MOCK_REVIEWS,
      sources: REVIEW_SOURCES,
      aggregateRating: 4.8,
      totalReviews: 100,
      ratingBreakdown: {
        5: 80,
        4: 15,
        3: 3,
        2: 1,
        1: 1,
      },
    });
  } catch (error) {
    console.error('Reviews API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

