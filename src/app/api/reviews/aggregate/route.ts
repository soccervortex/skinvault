import { NextResponse } from 'next/server';

// Lightweight endpoint that only returns aggregate rating and count
// Used for structured data and home page widget
export async function GET() {
  try {
    // Fetch from our reviews API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://skinvaults.online');
    
    const reviewsRes = await fetch(`${baseUrl}/api/reviews`, {
      cache: 'no-store', // Always fetch fresh data
    });

    if (reviewsRes.ok) {
      const data = await reviewsRes.json();
      return NextResponse.json({
        aggregateRating: data.aggregateRating,
        totalReviews: data.totalReviews,
        ratingBreakdown: data.ratingBreakdown,
      });
    }

    return NextResponse.json({
      aggregateRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
  } catch (error) {
    console.error('Aggregate reviews API error:', error);
    return NextResponse.json({
      aggregateRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
  }
}

