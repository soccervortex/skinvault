import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { dbGet, dbSet, dbDelete } from '@/app/utils/database';

// Get all item reports
export async function GET(request: Request) {
  try {
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

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// Update report status
export async function PATCH(request: Request) {
  try {
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

    // Also update in KV
    const report = await dbGet(`item_report:${reportId}`);
    if (report) {
      await dbSet(`item_report:${reportId}`, { ...report, ...update });
    }

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
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json(
        { error: 'Missing reportId' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    await db.collection('item_reports').deleteOne({ id: reportId });
    await dbDelete(`item_report:${reportId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}

