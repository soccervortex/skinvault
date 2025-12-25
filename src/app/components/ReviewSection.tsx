"use client";

import React, { useEffect, useState } from 'react';
import { Star, ExternalLink, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { isOwner } from '@/app/utils/owner-ids';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userIsOwner, setUserIsOwner] = useState(false);

  useEffect(() => {
    // Load user from localStorage
    const checkUser = () => {
      try {
        if (typeof window === 'undefined') return;
        const savedUser = window.localStorage.getItem('steam_user');
        const parsedUser = savedUser ? JSON.parse(savedUser) : null;
        setUser(parsedUser);
        setUserIsOwner(isOwner(parsedUser?.steamId));
      } catch {
        setUser(null);
        setUserIsOwner(false);
      }
    };

    checkUser();
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

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

  const handleDelete = async (reviewId: string) => {
    if (!userIsOwner || !user?.steamId) {
      alert('Only owners can delete reviews');
      return;
    }

    if (!confirm('Are you sure you want to delete this review?')) {
      return;
    }

    setDeletingId(reviewId);
    try {
      const res = await fetch(`/api/reviews/${reviewId}?adminSteamId=${user.steamId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to delete review' }));
        throw new Error(errorData.error || 'Failed to delete review');
      }

      // Refresh reviews after deletion
      if (data) {
        const deletedReview = data.reviews.find((r) => r.id === reviewId);
        const newRatingBreakdown = { ...data.ratingBreakdown };
        if (deletedReview) {
          newRatingBreakdown[deletedReview.rating] = Math.max(0, (newRatingBreakdown[deletedReview.rating] || 0) - 1);
        }

        const remainingReviews = data.reviews.filter((r) => r.id !== reviewId);
        const newTotalRating = remainingReviews.reduce((sum, r) => sum + r.rating, 0);
        const newAggregateRating = remainingReviews.length > 0 ? newTotalRating / remainingReviews.length : 0;

        setData({
          ...data,
          reviews: remainingReviews,
          totalReviews: remainingReviews.length,
          aggregateRating: newAggregateRating,
          ratingBreakdown: newRatingBreakdown,
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete review');
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const getRatingPercentage = (rating: number): number => {
    if (!data || data.totalReviews === 0) return 0;
    return (data.ratingBreakdown[rating] / data.totalReviews) * 100;
  };

  // Filter reviews based on selected rating
  const filteredReviews = data?.reviews.filter(
    (review) => filterRating === null || review.rating === filterRating
  ) || [];

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

        {/* Filter Buttons */}
        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-black uppercase text-gray-400">Filter by rating:</span>
            <button
              onClick={() => setFilterRating(null)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                filterRating === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-black/40 text-gray-400 hover:text-white hover:bg-black/60'
              }`}
            >
              All ({data.totalReviews})
            </button>
            {[5, 4, 3, 2, 1].map((rating) => (
              <button
                key={rating}
                onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1 ${
                  filterRating === rating
                    ? 'bg-blue-600 text-white'
                    : 'bg-black/40 text-gray-400 hover:text-white hover:bg-black/60'
                }`}
              >
                {rating}★ ({data.ratingBreakdown[rating] || 0})
              </button>
            ))}
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black uppercase text-gray-300">
            Customer Reviews {filterRating !== null && `(${filterRating}★)`} ({filteredReviews.length})
          </h2>
          {filterRating !== null && (
            <button
              onClick={() => setFilterRating(null)}
              className="text-xs text-blue-400 hover:text-blue-300 font-black uppercase"
            >
              Clear Filter
            </button>
          )}
        </div>
        
        {filteredReviews.length === 0 ? (
          <div className="bg-[#11141d] p-10 rounded-2xl border border-white/5 text-center">
            <p className="text-gray-500">
              {filterRating
                ? `No ${filterRating}-star reviews found.`
                : 'No reviews available yet. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
            {filteredReviews.map((review) => (
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

                      {/* Delete Button - Only for owners */}
                      {userIsOwner && (
                        <button
                          onClick={() => handleDelete(review.id)}
                          disabled={deletingId === review.id}
                          className="mt-4 flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === review.id ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 size={12} />
                              Delete Review
                            </>
                          )}
                        </button>
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

