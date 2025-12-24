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
    console.log('OUTSCRAPER_API_TOKEN present:', !!OUTSCRAPER_API_TOKEN);
    if (OUTSCRAPER_API_TOKEN) {
      try {
        // Outscraper Trustpilot Reviews API
        // Documentation: https://app.outscraper.cloud/api-docs
        // Query format: domain or full URL
        // Try both API endpoint formats
        const trustpilotUrl = `https://api.outscraper.com/trustpilot-reviews?query=skinvaults.online&limit=100&language=nl`;
        const trustpilotRes = await fetch(trustpilotUrl, {
          headers: {
            'X-API-KEY': OUTSCRAPER_API_TOKEN,
            'Content-Type': 'application/json',
          },
          // Cache for 1 hour to avoid rate limits
          next: { revalidate: 3600 },
        });
        
        console.log('Trustpilot API request:', trustpilotUrl);
        console.log('Trustpilot API status:', trustpilotRes.status);

        if (trustpilotRes.ok) {
          const trustpilotData = await trustpilotRes.json();
          console.log('Trustpilot API response:', JSON.stringify(trustpilotData).substring(0, 500));
          
          // Outscraper returns data in different formats, handle both
          // Format 1: { data: [...] }
          // Format 2: { result: [...] }
          // Format 3: Direct array
          // Format 4: { data: [{ reviews: [...] }] }
          let reviewsArray: any[] = [];
          
          if (Array.isArray(trustpilotData)) {
            reviewsArray = trustpilotData;
          } else if (trustpilotData?.data) {
            if (Array.isArray(trustpilotData.data)) {
              reviewsArray = trustpilotData.data;
            } else if (trustpilotData.data[0]?.reviews && Array.isArray(trustpilotData.data[0].reviews)) {
              reviewsArray = trustpilotData.data[0].reviews;
            }
          } else if (trustpilotData?.result && Array.isArray(trustpilotData.result)) {
            reviewsArray = trustpilotData.result;
          }
          
          console.log(`Found ${reviewsArray.length} Trustpilot reviews`);
          
          reviewsArray.forEach((review: any, index: number) => {
            // Handle different response formats
            const rating = parseInt(review.rating || review.stars || review.reviewRating || review.score || '0');
            if (rating >= 1 && rating <= 5) {
              trustpilotRating += rating;
              trustpilotCount++;
              ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;

              reviews.push({
                id: `trustpilot-${review.reviewId || review.id || index}`,
                source: 'Trustpilot',
                sourceUrl: review.reviewUrl || review.url || REVIEW_SOURCES[0].url,
                rating: rating,
                reviewerName: review.reviewerName || review.authorName || review.name || review.reviewer?.name || 'Anonymous',
                reviewerAvatar: review.reviewerAvatar || review.authorAvatar || review.avatar || review.reviewer?.avatar,
                reviewText: review.reviewText || review.review || review.content || review.text || review.reviewBody || '',
                date: review.reviewDate || review.date || review.createdDate || review.publishedDate || new Date().toISOString(),
                verified: review.verified || review.isVerified || false,
              });
            }
          });
        } else {
          const errorText = await trustpilotRes.text();
          console.error('Trustpilot API error:', trustpilotRes.status, errorText.substring(0, 500));
        }
      } catch (error) {
        console.error('Trustpilot API error (non-critical):', error);
      }
    }

    // Fetch Sitejabber reviews using Sitejabber API (free tier)
    // Documentation: https://apidocs.sitejabber.com/#reviews
    const SITEJABBER_CLIENT_TOKEN = process.env.SITEJABBER_CLIENT_TOKEN;
    const SITEJABBER_USER_TOKEN = process.env.SITEJABBER_USER_TOKEN;
    console.log('SITEJABBER_CLIENT_TOKEN present:', !!SITEJABBER_CLIENT_TOKEN);
    console.log('SITEJABBER_USER_TOKEN present:', !!SITEJABBER_USER_TOKEN);
    
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
          console.log('Sitejabber API response:', JSON.stringify(sitejabberData).substring(0, 500));
          
          if (sitejabberData?.reviews && Array.isArray(sitejabberData.reviews)) {
            console.log(`Found ${sitejabberData.reviews.length} Sitejabber reviews`);
            
            sitejabberData.reviews.forEach((review: any, index: number) => {
              // Sitejabber rating is in rating array - extract numeric value
              let rating = 0;
              if (Array.isArray(review.rating) && review.rating.length > 0) {
                rating = parseInt(review.rating[0]?.rating || review.rating[0] || '0');
              } else if (typeof review.rating === 'object' && review.rating?.rating) {
                rating = parseInt(review.rating.rating);
              } else {
                rating = parseInt(review.rating || '0');
              }
              
              if (rating >= 1 && rating <= 5) {
                sitejabberRating += rating;
                sitejabberCount++;
                ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;

                const reviewDate = review.created || review.createdRFC || review.date || review.published || review.publishedRFC;
                const formattedDate = reviewDate ? new Date(reviewDate).toISOString() : new Date().toISOString();
                
                reviews.push({
                  id: `sitejabber-${review.reviewNo || review.id || index}`,
                  source: 'Sitejabber',
                  sourceUrl: review.reviewUrl || REVIEW_SOURCES[1].url,
                  rating: rating,
                  reviewerName: review.author?.name || review.authorName || review.customer?.name || 'Anonymous',
                  reviewerAvatar: review.author?.avatar || review.customer?.avatar,
                  reviewText: review.content || review.reviewText || review.text || review.body || '',
                  date: formattedDate,
                  verified: review.verified || false,
                });
              }
            });
          } else {
            console.log('Sitejabber response structure:', Object.keys(sitejabberData || {}));
          }
        } else {
          const errorText = await sitejabberRes.text();
          console.error('Sitejabber API error:', sitejabberRes.status, errorText.substring(0, 500));
        }
      } catch (error) {
        console.error('Sitejabber API error (non-critical):', error);
      }
    }

    // Calculate aggregate rating
    const totalRating = trustpilotRating + sitejabberRating;
    const totalCount = trustpilotCount + sitejabberCount;
    const aggregateRating = totalCount > 0 ? totalRating / totalCount : null;

    console.log(`Reviews API: Found ${totalCount} reviews (Trustpilot: ${trustpilotCount}, Sitejabber: ${sitejabberCount}), Aggregate: ${aggregateRating}`);

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

