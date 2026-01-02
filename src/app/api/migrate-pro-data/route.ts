import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getAllProUsers, grantPro } from '@/app/utils/pro-storage';

// One-time migration script to move data from pro-users.json to MongoDB
// Run this once after setting up MongoDB: GET /api/migrate-pro-data

export async function GET() {
  try {
    // Read existing JSON file
    const PRO_DATA_PATH = path.join(process.cwd(), 'pro-users.json');
    let jsonData: Record<string, string> = {};

    try {
      const raw = await fs.readFile(PRO_DATA_PATH, 'utf-8');
      jsonData = JSON.parse(raw);
    } catch {
      return NextResponse.json({ message: 'No pro-users.json file found or already migrated' });
    }

    // Check what's already in MongoDB
    const mongoData = await getAllProUsers();

    // Migrate each user - preserve exact expiry dates
    const results = [];
    const allData = { ...mongoData }; // Start with existing MongoDB data
    
    for (const [steamId, proUntil] of Object.entries(jsonData)) {
      const expiry = new Date(proUntil);
      const now = new Date();
      
      // Only migrate if not already in MongoDB or if JSON has a later date
      const existing = mongoData[steamId];
      if (!existing || expiry > new Date(existing)) {
        if (expiry > now) {
          // Preserve the exact expiry date
          allData[steamId] = proUntil;
          results.push({ steamId, migrated: true, proUntil, status: 'Active' });
        } else {
          results.push({ steamId, migrated: false, proUntil, reason: 'Already expired' });
        }
      } else {
        results.push({ steamId, migrated: false, reason: 'Already in MongoDB with same or later date' });
      }
    }
    
    // Write all data to MongoDB at once (preserving exact dates)
    if (Object.keys(allData).length > Object.keys(mongoData).length || 
        Object.entries(allData).some(([id, date]) => mongoData[id] !== date)) {
      // Use writeProData from pro-storage
      const { writeProData } = await import('@/app/utils/pro-storage');
      await writeProData(allData);
    }

    return NextResponse.json({
      message: 'Migration complete',
      total: Object.keys(jsonData).length,
      migrated: results.filter(r => r.migrated).length,
      skipped: results.filter(r => !r.migrated).length,
      results,
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ error: error.message || 'Migration failed' }, { status: 500 });
  }
}
