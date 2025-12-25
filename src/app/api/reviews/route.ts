import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

interface ReviewsData {
  reviews: Review[];
  sources: Array<{ name: string; url: string }>;
  aggregateRating: number;
  totalReviews: number;
  ratingBreakdown: Record<number, number>;
}

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key must be configured');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Fetch all reviews from Supabase
    const { data: reviewsData, error } = await supabase
      .from('reviews')
      .select('*')
      .order('review_date', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!reviewsData || reviewsData.length === 0) {
      return NextResponse.json({
        reviews: [],
        sources: REVIEW_SOURCES,
        aggregateRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
    }

    // Transform Supabase data to match our Review interface
    const reviews: Review[] = reviewsData.map((review: any) => {
      // Map source to sourceUrl
      const sourceUrl = review.source === 'Trustpilot' 
        ? REVIEW_SOURCES[0].url 
        : REVIEW_SOURCES[1].url;

      return {
        id: review.id,
        source: review.source || 'Trustpilot',
        sourceUrl: sourceUrl,
        rating: review.rating || 0,
        reviewerName: review.reviewer_name || 'Anonymous',
        reviewerAvatar: review.reviewer_avatar || undefined,
        reviewText: review.review_text || '',
        date: review.review_date || new Date().toISOString(),
        verified: review.verified || false,
      };
    });

    // Calculate aggregate statistics
    let totalRating = 0;
    let totalCount = 0;
    const ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach((review) => {
      if (review.rating >= 1 && review.rating <= 5) {
        totalRating += review.rating;
        totalCount++;
        ratingBreakdown[review.rating] = (ratingBreakdown[review.rating] || 0) + 1;
      }
    });

    const aggregateRating = totalCount > 0 ? totalRating / totalCount : 0;

    console.log(`Reviews API: Found ${totalCount} reviews from Supabase, Aggregate: ${aggregateRating.toFixed(2)}`);

    return NextResponse.json({
      reviews: reviews,
      sources: REVIEW_SOURCES,
      aggregateRating: aggregateRating,
      totalReviews: totalCount,
      ratingBreakdown: ratingBreakdown,
    });
  } catch (error) {
    console.error('Reviews API error:', error);
    return NextResponse.json(
      { 
        reviews: [],
        sources: REVIEW_SOURCES,
        aggregateRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        error: 'Failed to fetch reviews' 
      },
      { status: 500 }
    );
  }
}
