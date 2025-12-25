"use client";

import React, { useEffect, useState } from 'react';
import { Star, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';

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

export default function ReviewSection() {
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch('/api/reviews');
        if (!res.ok) {
          throw new Error('Failed to fetch reviews');
        }
        const reviewsData = await res.json();
        setData(reviewsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
        console.error('Failed to fetch reviews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const renderStars = (rating: number, size: number = 16) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={size}
        className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const getRatingPercentage = (rating: number): number => {
    if (!data || data.totalReviews === 0) return 0;
    return (data.ratingBreakdown[rating] / data.totalReviews) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#11141d] p-10 rounded-2xl border border-white/5 text-center">
        <p className="text-gray-500">
          {error || 'No reviews available yet. Check back soon!'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Aggregate Summary */}
      <div className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8">
          {/* Left: Rating Display */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-black text-blue-500 mb-2">
                {data.aggregateRating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-1 mb-2">
                {renderStars(Math.round(data.aggregateRating), 20)}
              </div>
              <div className="text-sm text-gray-400">
                Based on {data.totalReviews} {data.totalReviews === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          </div>

          {/* Right: Rating Breakdown */}
          <div className="flex-1 w-full md:w-auto">
            <h3 className="text-lg font-black uppercase mb-4 text-gray-300">Rating Breakdown</h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 min-w-[80px]">
                    <span className="text-sm font-bold text-gray-400">{rating}</span>
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-yellow-400 h-full transition-all duration-500"
                      style={{ width: `${getRatingPercentage(rating)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400 min-w-[40px] text-right">
                    {data.ratingBreakdown[rating] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Review Sources */}
      {data.sources.length > 0 && (
        <div className="bg-[#11141d] p-6 rounded-2xl border border-white/5">
          <h2 className="text-lg font-black uppercase mb-4 text-gray-300">Review Sources</h2>
          <div className="flex flex-wrap gap-4">
            {data.sources.map((source) => (
              <a
                key={source.name}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/40 rounded-lg hover:bg-blue-600/30 transition-all"
              >
                <span className="text-sm font-black uppercase">{source.name}</span>
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Individual Reviews List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-black uppercase text-gray-300 mb-4">
          Customer Reviews ({data.reviews.length})
        </h2>
        
        {data.reviews.length === 0 ? (
          <div className="bg-[#11141d] p-10 rounded-2xl border border-white/5 text-center">
            <p className="text-gray-500">No reviews available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
            {data.reviews.map((review) => (
              <div
                key={review.id}
                className="bg-[#11141d] p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    {review.reviewerAvatar ? (
                      <img
                        src={review.reviewerAvatar}
                        alt={review.reviewerName}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-black text-blue-400">
                          {review.reviewerName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Review Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-black uppercase text-white">{review.reviewerName}</h3>
                        {review.verified && (
                          <div className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 size={14} />
                            <span className="font-bold">Verified</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1">
                          {renderStars(review.rating)}
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(review.date)}</span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500">{review.source}</span>
                      </div>

                      {review.reviewText && (
                        <p className="text-sm text-gray-300 leading-relaxed mt-3">
                          {review.reviewText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Source Link */}
                  <a
                    href={review.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 ml-4 flex-shrink-0"
                  >
                    <span className="hidden md:inline">View on</span>
                    {review.source}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

