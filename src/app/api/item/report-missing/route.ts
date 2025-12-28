import { NextResponse } from 'next/server';
import { getDatabase } from '@/app/utils/mongodb-client';
import { dbSet } from '@/app/utils/database';

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1454721539315470376/o8WS6sffMhdYgsPMZq8u0j1hhfVfak88AqoBc8nrngkMxK0rEOu39gzEYSfCFEobf4Lz';

interface ReportData {
  itemName: string;
  itemId: string;
  itemImage?: string;
  reason: string;
}

// Check if item exists in the API
async function checkItemExists(itemId: string, itemName: string): Promise<boolean> {
  try {
    const API_FILES = ['skins_not_grouped.json', 'crates.json', 'stickers.json', 'agents.json'];
    const BASE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
    
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

// Send Discord webhook notification
async function sendDiscordNotification(report: ReportData, existsInAPI: boolean) {
  try {
    const embed = {
      title: '🔍 Missing Item Report',
      description: existsInAPI 
        ? '⚠️ **Item exists in API but may have issues**'
        : '❌ **Item not found in API**',
      color: existsInAPI ? 0xffaa00 : 0xff0000,
      fields: [
        {
          name: 'Item Name',
          value: report.itemName || 'N/A',
          inline: true,
        },
        {
          name: 'Item ID',
          value: `\`${report.itemId}\``,
          inline: true,
        },
        {
          name: 'Reason',
          value: report.reason || 'No reason provided',
          inline: false,
        },
        {
          name: 'Status',
          value: existsInAPI ? '✅ Found in API' : '❌ Not in API',
          inline: true,
        },
        {
          name: 'Timestamp',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
      ],
      ...(report.itemImage && {
        thumbnail: {
          url: report.itemImage,
        },
      }),
      footer: {
        text: 'SkinVaults Item Report System',
      },
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
}

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
      itemImage: itemImage || null,
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
      
      // Also save to KV for quick access
      await dbSet(`item_report:${reportId}`, report);
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue even if DB fails
    }

    // Send Discord notification
    await sendDiscordNotification(report, existsInAPI);

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

