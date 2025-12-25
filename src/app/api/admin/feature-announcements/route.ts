import { NextResponse } from 'next/server';
import { isOwner } from '@/app/utils/owner-ids';
import {
  getAllFeatureAnnouncements,
  createFeatureAnnouncement,
  deleteFeatureAnnouncement,
  getUnpostedFeatureAnnouncements,
} from '@/app/lib/feature-announcements';

/**
 * GET: Get all feature announcements
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const announcements = await getAllFeatureAnnouncements();
    return NextResponse.json({ announcements });
  } catch (error) {
    console.error('Failed to get feature announcements:', error);
    return NextResponse.json({ error: 'Failed to get feature announcements' }, { status: 500 });
  }
}

/**
 * POST: Create a new feature announcement
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, link, scheduledDate } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const announcement = await createFeatureAnnouncement(title, description, link, scheduledDate);
    return NextResponse.json({ success: true, announcement });
  } catch (error) {
    console.error('Failed to create feature announcement:', error);
    return NextResponse.json({ error: 'Failed to create feature announcement' }, { status: 500 });
  }
}

/**
 * DELETE: Delete a feature announcement
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const adminSteamId = url.searchParams.get('adminSteamId');
    const id = url.searchParams.get('id');

    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 });
    }

    await deleteFeatureAnnouncement(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete feature announcement:', error);
    return NextResponse.json({ error: 'Failed to delete feature announcement' }, { status: 500 });
  }
}

