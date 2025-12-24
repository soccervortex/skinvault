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

// Free API integrations using Outscraper (Trustpilot) and Sitejabber API
// These use environment variables for API keys
export async function GET() {
  try {
    const reviews: Review[] = [];
    let trustpilotRating = 0;
    let trustpilotCount = 0;
    let sitejabberRating = 0;
    let sitejabberCount = 0;
    const ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    // Fetch Trustpilot reviews using Outscraper API (free tier)
    // Documentation: https://app.outscraper.cloud/api-docs?ln=nl#tag/trustpilot/GET/trustpilot-reviews
    const OUTSCRAPER_API_TOKEN = process.env.OUTSCRAPER_API_TOKEN;
    if (OUTSCRAPER_API_TOKEN) {
      try {
        // Outscraper Trustpilot Reviews API
        // Query format: domain or full URL
        const trustpilotUrl = `https://api.outscraper.com/trustpilot-reviews?query=skinvaults.online&limit=100&language=nl`;
        const trustpilotRes = await fetch(trustpilotUrl, {
          headers: {
            'X-API-KEY': OUTSCRAPER_API_TOKEN,
          },
          // Cache for 1 hour to avoid rate limits
          next: { revalidate: 3600 },
        });

        if (trustpilotRes.ok) {
          const trustpilotData = await trustpilotRes.json();
          // Outscraper returns data in different formats, handle both
          const reviewsData = trustpilotData?.data || trustpilotData?.result || trustpilotData;
          const reviewsArray = Array.isArray(reviewsData) ? reviewsData : (reviewsData ? [reviewsData] : []);
          
          reviewsArray.forEach((review: any, index: number) => {
            // Handle different response formats
            const rating = parseInt(review.rating || review.stars || review.reviewRating || '0');
            if (rating >= 1 && rating <= 5) {
              trustpilotRating += rating;
              trustpilotCount++;
              ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;

              reviews.push({
                id: `trustpilot-${review.reviewId || review.id || index}`,
                source: 'Trustpilot',
                sourceUrl: review.reviewUrl || review.url || REVIEW_SOURCES[0].url,
                rating: rating,
                reviewerName: review.reviewerName || review.authorName || review.name || 'Anonymous',
                reviewerAvatar: review.reviewerAvatar || review.authorAvatar || review.avatar,
                reviewText: review.reviewText || review.review || review.content || review.text || '',
                date: review.reviewDate || review.date || review.createdDate || new Date().toISOString(),
                verified: review.verified || review.isVerified || false,
              });
            }
          });
        }
      } catch (error) {
        console.warn('Trustpilot API error (non-critical):', error);
      }
    }

    // Fetch Sitejabber reviews using Sitejabber API (free tier)
    const SITEJABBER_CLIENT_TOKEN = process.env.SITEJABBER_CLIENT_TOKEN;
    const SITEJABBER_USER_TOKEN = process.env.SITEJABBER_USER_TOKEN;
    
    if (SITEJABBER_CLIENT_TOKEN && SITEJABBER_USER_TOKEN) {
      try {
        // Sitejabber Reviews API - Get reviews for business
        const sitejabberUrl = `https://api.sitejabber.com/v1/businesses/skinvaults.online/reviews?client_token=${SITEJABBER_CLIENT_TOKEN}`;
        const sitejabberRes = await fetch(sitejabberUrl, {
          headers: {
            'user_token': SITEJABBER_USER_TOKEN,
          },
        });

        if (sitejabberRes.ok) {
          const sitejabberData = await sitejabberRes.json();
          if (sitejabberData?.reviews && Array.isArray(sitejabberData.reviews)) {
            sitejabberData.reviews.forEach((review: any, index: number) => {
              // Sitejabber rating is in rating array
              const ratingObj = Array.isArray(review.rating) ? review.rating[0] : review.rating;
              const rating = ratingObj?.rating || parseInt(review.rating || '0');
              
              if (rating >= 1 && rating <= 5) {
                sitejabberRating += rating;
                sitejabberCount++;
                ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;

                reviews.push({
                  id: `sitejabber-${review.reviewNo || index}`,
                  source: 'Sitejabber',
                  sourceUrl: review.reviewUrl || REVIEW_SOURCES[1].url,
                  rating: rating,
                  reviewerName: review.author?.name || review.authorName || 'Anonymous',
                  reviewerAvatar: review.author?.avatar,
                  reviewText: review.content || review.reviewText || '',
                  date: review.created || review.createdRFC || new Date().toISOString(),
                  verified: review.verified || false,
                });
              }
            });
          }
        }
      } catch (error) {
        console.warn('Sitejabber API error (non-critical):', error);
      }
    }

    // Calculate aggregate rating
    const totalRating = trustpilotRating + sitejabberRating;
    const totalCount = trustpilotCount + sitejabberCount;
    const aggregateRating = totalCount > 0 ? totalRating / totalCount : null;

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
        aggregateRating: null,
        totalReviews: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        error: 'Failed to fetch reviews' 
      },
      { status: 500 }
    );
  }
}

