import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { grantPro, getAllProUsers } from '@/app/utils/pro-storage';

// One-time migration script to move data from pro-users.json to Vercel KV
// Run this once after setting up KV: GET /api/migrate-pro-data

export async function GET() {
  try {
    // Check if KV is configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json(
        { error: 'KV not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN in environment variables.' },
        { status: 400 }
      );
    }

    // Read existing JSON file
    const PRO_DATA_PATH = path.join(process.cwd(), 'pro-users.json');
    let jsonData: Record<string, string> = {};

    try {
      const raw = await fs.readFile(PRO_DATA_PATH, 'utf-8');
      jsonData = JSON.parse(raw);
    } catch {
      return NextResponse.json({ message: 'No pro-users.json file found or already migrated' });
    }

    // Check what's already in KV
    const kvData = await getAllProUsers();

    // Migrate each user - preserve exact expiry dates
    const results = [];
    const { kv } = await import('@vercel/kv');
    const allData = { ...kvData }; // Start with existing KV data
    
    for (const [steamId, proUntil] of Object.entries(jsonData)) {
      const expiry = new Date(proUntil);
      const now = new Date();
      
      // Only migrate if not already in KV or if JSON has a later date
      const existing = kvData[steamId];
      if (!existing || expiry > new Date(existing)) {
        if (expiry > now) {
          // Preserve the exact expiry date
          allData[steamId] = proUntil;
          results.push({ steamId, migrated: true, proUntil, status: 'Active' });
        } else {
          results.push({ steamId, migrated: false, proUntil, reason: 'Already expired' });
        }
      } else {
        results.push({ steamId, migrated: false, reason: 'Already in KV with same or later date' });
      }
    }
    
    // Write all data to KV at once (preserving exact dates)
    if (Object.keys(allData).length > Object.keys(kvData).length || 
        Object.entries(allData).some(([id, date]) => kvData[id] !== date)) {
      await kv.set('pro_users', allData);
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
