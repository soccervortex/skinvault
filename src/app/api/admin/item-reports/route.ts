import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { isOwnerRequest } from '@/app/utils/admin-auth';

// Get all item reports
export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional admin check (can be removed if not needed)
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    const db = await getDatabase();
    let query: any = {};
    
    if (status !== 'all') {
      query.status = status;
    }

    const reports = await db.collection('item_reports')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Return reports array directly (frontend expects { reports } or array)
    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// Update report status
export async function PATCH(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reportId, status, reviewedBy } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const update: any = {
      status,
      reviewedAt: new Date().toISOString(),
    };

    if (reviewedBy) {
      update.reviewedBy = reviewedBy;
    }

    await db.collection('item_reports').updateOne(
      { id: reportId },
      { $set: update }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}

// Delete report
export async function DELETE(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json(
        { error: 'Missing reportId' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // First, check if there's a custom item linked to this report
    const customItem = await db.collection('custom_items').findOne({ reportId });
    
    // Delete the report
    await db.collection('item_reports').deleteOne({ id: reportId });

    // If there's a linked custom item, delete it as well
    if (customItem) {
      await db.collection('custom_items').deleteOne({ id: customItem.id });
    }

    return NextResponse.json({ 
      success: true,
      deletedCustomItem: !!customItem 
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}

