"use client";

import React, { useEffect, useState } from 'react';
import { Star, ExternalLink, Loader2 } from 'lucide-react';
import Sidebar from '@/app/components/Sidebar';

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
  aggregateRating: number | null;
  totalReviews: number;
  ratingBreakdown: Record<number, number>;
}

export default function ReviewsPage() {
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<number | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch('/api/reviews');
        if (res.ok) {
          const reviewsData = await res.json();
          setData(reviewsData);
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const filteredReviews = data?.reviews.filter(
    (review) => filterRating === null || review.rating === filterRating
  ) || [];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex h-screen bg-[#08090d] text-white overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 pb-32">
          <header className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-2xl">
            <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-4">
              Customer Reviews
            </h1>
            {data && data.totalReviews > 0 && data.aggregateRating !== null ? (
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-4xl md:text-5xl font-black text-blue-500">
                    {data.aggregateRating.toFixed(1)}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      {renderStars(Math.round(data.aggregateRating))}
                    </div>
                    <span className="text-xs text-gray-500">
                      Based on {data.totalReviews} reviews
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                        filterRating === rating
                          ? 'bg-blue-600 text-white'
                          : 'bg-black/40 text-gray-400 hover:text-white'
                      }`}
                    >
                      {rating}★ ({data.ratingBreakdown[rating] || 0})
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">
                  Reviews are displayed on Trustpilot and Sitejabber. Visit the links below to see and write reviews.
                </p>
              </div>
            )}
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {data && data.sources.length > 0 && (
                <div className="bg-[#11141d] p-6 rounded-2xl border border-white/5">
                  <h2 className="text-lg font-black uppercase mb-4">Review Sources</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Reviews are displayed on Trustpilot and Sitejabber. Visit the links below to see reviews and write your own.
                  </p>
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

              {filteredReviews.length === 0 ? (
                <div className="bg-[#11141d] p-10 rounded-2xl border border-white/5 text-center">
                  <p className="text-gray-400 mb-4">
                    {filterRating
                      ? `No ${filterRating}-star reviews found.`
                      : 'Reviews are displayed on Trustpilot and Sitejabber. Visit the links above to see reviews and write your own.'}
                  </p>
                  {!filterRating && data && data.sources.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 mt-6">
                      {data.sources.map((source) => (
                        <a
                          key={source.name}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-black uppercase transition-all"
                        >
                          View on {source.name}
                          <ExternalLink size={16} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-[#11141d] p-6 rounded-2xl border border-white/5"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          {review.reviewerAvatar ? (
                            <img
                              src={review.reviewerAvatar}
                              alt={review.reviewerName}
                              className="w-12 h-12 rounded-full"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                              <span className="text-lg font-black">
                                {review.reviewerName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black uppercase">{review.reviewerName}</h3>
                              {review.verified && (
                                <span className="text-xs text-emerald-400">✓ Verified</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {renderStars(review.rating)}
                              <span className="text-xs text-gray-500">{formatDate(review.date)}</span>
                            </div>
                          </div>
                        </div>
                        <a
                          href={review.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          {review.source}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{review.reviewText}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
