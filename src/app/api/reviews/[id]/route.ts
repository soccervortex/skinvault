import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key must be configured');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized - Owner access required' }, { status: 401 });
    }
    const supabase = getSupabaseClient();

    // Delete review from Supabase
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete review' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    return NextResponse.json(
      { error: 'Failed to delete review' },
      { status: 500 }
    );
  }
}

