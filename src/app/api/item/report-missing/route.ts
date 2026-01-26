import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { API_FILES, BASE_URL } from '@/data/api-endpoints';
import { notifyItemReport } from '@/app/utils/discord-webhook';

// Using centralized Discord webhook utility

interface ReportData {
  itemName: string;
  itemId: string;
  itemImage?: string | null;
  reason: string;
}

// Check if item exists in the API
async function checkItemExists(itemId: string, itemName: string): Promise<boolean> {
  try {
    // Check ALL available API endpoints
    for (const file of API_FILES) {
      try {
        const response = await fetch(`${BASE_URL}/${file}`, { 
          next: { revalidate: 3600 }
        });
        if (!response.ok) continue;
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.values(data);
        
        const found = items.find((i: any) => 
          i.id === itemId || 
          i.market_hash_name === itemId || 
          i.name === itemId ||
          i.market_hash_name === itemName ||
          i.name === itemName
        );
        
        if (found) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Discord notification is now handled by centralized utility

export async function POST(request: Request) {
  try {
    const body: ReportData = await request.json();
    const { itemName, itemId, itemImage, reason } = body;

    if (!itemName || !itemId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if item exists in API
    const existsInAPI = await checkItemExists(itemId, itemName);

    // Store report in database
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const report = {
      id: reportId,
      itemName,
      itemId,
      itemImage: itemImage || undefined,
      reason,
      existsInAPI,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
    };

    // Save to database
    try {
      const db = await getDatabase();
      await db.collection('item_reports').insertOne(report);
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue even if DB fails
    }

    // Send Discord notification using centralized utility
    notifyItemReport(
      report.itemName,
      report.itemId,
      report.reason,
      existsInAPI,
      report.itemImage || undefined
    ).catch(error => {
      console.error('Failed to send item report notification:', error);
    });

    return NextResponse.json({ 
      success: true, 
      reportId,
      existsInAPI 
    });
  } catch (error) {
    console.error('Error reporting missing item:', error);
    return NextResponse.json(
      { error: 'Failed to process report' },
      { status: 500 }
    );
  }
}

