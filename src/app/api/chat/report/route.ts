import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { dbGet } from '@/app/utils/database';
import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

interface Report {
  _id?: string;
  reporterSteamId: string;
  reporterName: string;
  reportedSteamId: string;
  reportedName: string;
  reportType: 'global' | 'dm';
  dmId?: string; // For DM reports
  conversationLog: Array<{
    steamId: string;
    steamName: string;
    message: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  status: 'pending' | 'reviewed' | 'resolved';
  adminNotes?: string;
}

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

// POST: Create a report
export async function POST(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { reporterSteamId, reporterName, reportedSteamId, reportedName, reportType, dmId } = body;

    if (!reporterSteamId || !reportedSteamId || !reportType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (reporterSteamId === reportedSteamId) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);

    // Fetch conversation log
    const conversationLog: Array<{
      steamId: string;
      steamName: string;
      message: string;
      timestamp: Date;
    }> = [];

    if (reportType === 'global') {
      // Get last 50 messages from global chat involving both users
      const collectionNames = getCollectionNamesForDays(2);
      const allMessages: any[] = [];
      
      for (const collectionName of collectionNames) {
        const collection = db.collection(collectionName);
        const messages = await collection
          .find({
            $or: [
              { steamId: reporterSteamId },
              { steamId: reportedSteamId }
            ]
          })
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray();
        allMessages.push(...messages);
      }

      // Sort by timestamp and get last 50
      allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const recentMessages = allMessages.slice(0, 50).reverse();

      conversationLog.push(...recentMessages.map(msg => ({
        steamId: msg.steamId,
        steamName: msg.steamName,
        message: msg.message,
        timestamp: msg.timestamp,
      })));
    } else if (reportType === 'dm' && dmId) {
      // Get DM messages
      const collectionNames = getDMCollectionNamesForDays(7);
      
      for (const collectionName of collectionNames) {
        const collection = db.collection(collectionName);
        const messages = await collection
          .find({ dmId })
          .sort({ timestamp: 1 })
          .toArray();
        
        conversationLog.push(...messages.map(msg => ({
          steamId: msg.senderId,
          steamName: msg.steamName || 'Unknown',
          message: msg.message,
          timestamp: msg.timestamp,
        })));
      }
    }

    // Create report
    const reportsCollection = db.collection<Report>('chat_reports');
    const report: Report = {
      reporterSteamId,
      reporterName: reporterName || 'Unknown',
      reportedSteamId,
      reportedName: reportedName || 'Unknown',
      reportType,
      dmId: reportType === 'dm' ? dmId : undefined,
      conversationLog,
      createdAt: new Date(),
      status: 'pending',
    };

    await reportsCollection.insertOne(report);
    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'Report submitted successfully',
      reportId: report._id?.toString(),
    });
  } catch (error) {
    console.error('Failed to create report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}

// GET: Get reports (admin only)
export async function GET(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ reports: [] });
    }

    const { searchParams } = new URL(request.url);
    const adminSteamId = searchParams.get('adminSteamId');
    const status = searchParams.get('status'); // 'pending', 'reviewed', 'resolved', or null for all

    // Verify admin
    const { isOwner } = await import('@/app/utils/owner-ids');
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const reportsCollection = db.collection<Report>('chat_reports');

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const reports = await reportsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    await client.close();

    return NextResponse.json({
      reports: reports.map(report => ({
        id: report._id?.toString(),
        reporterSteamId: report.reporterSteamId,
        reporterName: report.reporterName,
        reportedSteamId: report.reportedSteamId,
        reportedName: report.reportedName,
        reportType: report.reportType,
        dmId: report.dmId,
        conversationLog: report.conversationLog,
        createdAt: report.createdAt,
        status: report.status,
        adminNotes: report.adminNotes,
      }))
    });
  } catch (error) {
    console.error('Failed to get reports:', error);
    return NextResponse.json({ error: 'Failed to get reports' }, { status: 500 });
  }
}

// PATCH: Update report status (admin only)
export async function PATCH(request: Request) {
  try {
    if (!MONGODB_URI) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { reportId, adminSteamId, status, adminNotes } = body;

    // Verify admin
    const { isOwner } = await import('@/app/utils/owner-ids');
    if (!adminSteamId || !isOwner(adminSteamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(MONGODB_DB_NAME);
    const reportsCollection = db.collection<Report>('chat_reports');

    const update: any = { status };
    if (adminNotes) {
      update.adminNotes = adminNotes;
    }

    // Convert reportId string to ObjectId
    let objectId;
    try {
      objectId = new ObjectId(reportId);
    } catch (error) {
      await client.close();
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
    }

    await reportsCollection.updateOne(
      { _id: objectId } as any,
      { $set: update }
    );

    await client.close();

    return NextResponse.json({ success: true, message: 'Report updated' });
  } catch (error) {
    console.error('Failed to update report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}

