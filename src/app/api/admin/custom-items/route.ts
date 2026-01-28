import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { dbGet, dbSet, dbDelete } from '@/app/utils/database';
import { submitItemToIndexNow } from '@/app/utils/indexnow';
import { submitItemToGoogleIndexing } from '@/app/utils/google-indexing';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

// Get all custom items
export async function GET(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDatabase();
    const customItems = await db.collection('custom_items')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ items: customItems });
  } catch (error) {
    console.error('Error fetching custom items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom items' },
      { status: 500 }
    );
  }
}

// Create or update custom item
export async function POST(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      id,
      name,
      marketHashName,
      image,
      rarity,
      weapon,
      description,
      reportId, // Link to the report that triggered this
    } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: id and name' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const customItem = {
      id,
      name,
      marketHashName: marketHashName || name,
      image: image || null,
      rarity: rarity || null,
      weapon: weapon || null,
      description: description || null,
      reportId: reportId || null,
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check if item already exists
    const existing = await db.collection('custom_items').findOne({ id });
    
    if (existing) {
      // Update existing
      await db.collection('custom_items').updateOne(
        { id },
        { $set: { ...customItem, updatedAt: new Date().toISOString() } }
      );
    } else {
      // Create new
      await db.collection('custom_items').insertOne(customItem);
    }

    // Also save to KV
    await dbSet(`custom_item:${id}`, customItem);

    // If linked to a report, mark it as resolved
    if (reportId) {
      await db.collection('item_reports').updateOne(
        { id: reportId },
        { 
          $set: { 
            status: 'resolved',
            reviewedAt: new Date().toISOString(),
          } 
        }
      );
    }

    // Submit to IndexNow for real-time search engine indexing
    // Fire and forget - don't block the response if IndexNow fails
    submitItemToIndexNow(id).catch((error) => {
      console.error('Failed to submit item to IndexNow:', error);
      // Don't throw - IndexNow is non-critical
    });

    // Submit to Google Indexing API (if configured)
    // Fire and forget - don't block the response if Google indexing fails
    const googleEnabled = String(process.env.GOOGLE_INDEXING_ENABLED || '').toLowerCase() === 'true';
    if (googleEnabled) {
      submitItemToGoogleIndexing(id).catch((error) => {
        console.error('Failed to submit item to Google Indexing:', error);
      });
    }

    return NextResponse.json({ success: true, item: customItem });
  } catch (error) {
    console.error('Error creating custom item:', error);
    return NextResponse.json(
      { error: 'Failed to create custom item' },
      { status: 500 }
    );
  }
}

// Delete custom item
export async function DELETE(request: NextRequest) {
  try {
    if (!isOwnerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    await db.collection('custom_items').deleteOne({ id: itemId });
    await dbDelete(`custom_item:${itemId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom item:', error);
    return NextResponse.json(
      { error: 'Failed to delete custom item' },
      { status: 500 }
    );
  }
}

