import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { dbGet } from '@/app/utils/database';
import { getChatDatabase, hasChatMongoConfig } from '@/app/utils/mongodb-client';
import { getCollectionNamesForDays, getDMCollectionNamesForDays } from '@/app/utils/chat-collections';
import { notifyChatReport } from '@/app/utils/discord-webhook';
import type { NextRequest } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

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

// POST: Create a report
export async function POST(request: Request) {
  try {
    if (!hasChatMongoConfig()) {
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

    const db = await getChatDatabase();

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
      const collectionNames = getDMCollectionNamesForDays(365);
      
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
    // Don't close connection - it's from shared pool

    const reportId = report._id?.toString() || '';
    
    // Send Discord notification for chat report
    if (reportId) {
      notifyChatReport(
        reporterSteamId,
        reporterName || 'Unknown',
        reportedSteamId,
        reportedName || 'Unknown',
        reportType,
        reportId
      ).catch(error => {
        console.error('Failed to send chat report notification:', error);
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Report submitted successfully',
      reportId,
    });
  } catch (error) {
    console.error('Failed to create report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}

// GET: Get reports (admin only)
export async function GET(request: Request) {
  try {
    if (!hasChatMongoConfig()) {
      return NextResponse.json({ reports: [] });
    }

    if (!isOwnerRequest(request as NextRequest)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'reviewed', 'resolved', or null for all

    const db = await getChatDatabase();
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

    // Don't close connection - it's from shared pool

    return NextResponse.json({
      reports: reports.map((report: any) => ({
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
    if (!hasChatMongoConfig()) {
      return NextResponse.json({ error: 'MongoDB not configured' }, { status: 500 });
    }

    if (!isOwnerRequest(request as NextRequest)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { reportId, status, adminNotes } = body;

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const db = await getChatDatabase();
    const reportsCollection = db.collection<Report>('chat_reports');

    const update: any = { 
      status,
      lastUpdated: new Date()
    };
    if (adminNotes !== undefined) {
      update.adminNotes = adminNotes;
    }

    // Convert reportId string to ObjectId
    let objectId;
    try {
      objectId = new ObjectId(reportId);
    } catch (error) {
      // Don't close connection - it's from shared pool
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
    }

    await reportsCollection.updateOne(
      { _id: objectId } as any,
      { $set: update }
    );

    // Don't close connection - it's from shared pool

    return NextResponse.json({ success: true, message: 'Report updated' });
  } catch (error) {
    console.error('Failed to update report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}

