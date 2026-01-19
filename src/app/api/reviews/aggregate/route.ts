import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lightweight endpoint that only returns aggregate rating and count
// Used for structured data and home page widget
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      const res = NextResponse.json({
        aggregateRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
      res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      return res;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: rows, error } = await supabase.from('reviews').select('rating');
    if (error || !Array.isArray(rows)) {
      const res = NextResponse.json({
        aggregateRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
      res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      return res;
    }

    let totalRating = 0;
    let totalCount = 0;
    const ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of rows as any[]) {
      const rating = Number(r?.rating || 0);
      if (rating >= 1 && rating <= 5) {
        totalRating += rating;
        totalCount++;
        ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;
      }
    }
    const aggregateRating = totalCount > 0 ? totalRating / totalCount : 0;

    const res = NextResponse.json({
      aggregateRating,
      totalReviews: totalCount,
      ratingBreakdown,
    });
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res;
  } catch (error) {
    console.error('Aggregate reviews API error:', error);
    const res = NextResponse.json({
      aggregateRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res;
  }
}

