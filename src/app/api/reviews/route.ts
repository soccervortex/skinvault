import { NextResponse } from 'next/server';

// Review sources configuration
const REVIEW_SOURCES = [
  {
    name: 'Trustpilot',
    url: 'https://nl.trustpilot.com/review/skinvaults.online',
  },
  {
    name: 'Sitejabber',
    url: 'https://www.sitejabber.com/reviews/skinvaults.online',
  },
];

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

// Trustpilot and Sitejabber don't have public APIs
// We'll return empty reviews and let users visit the actual review sites
// The aggregate rating will be calculated from actual reviews on those platforms
export async function GET() {
  try {
    // Since Trustpilot and Sitejabber don't have public APIs,
    // we return empty reviews array and let the frontend link to the actual review sites
    // The actual ratings will be shown via structured data and Trustpilot/Sitejabber widgets
    
    return NextResponse.json({
      reviews: [], // Empty - reviews are on Trustpilot and Sitejabber sites
      sources: REVIEW_SOURCES,
      aggregateRating: null, // Will be calculated from actual reviews on Trustpilot/Sitejabber
      totalReviews: 0, // Will be updated when reviews are available
      ratingBreakdown: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
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

