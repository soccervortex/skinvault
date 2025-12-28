import { NextResponse } from 'next/server';
import { dbGet } from '@/app/utils/database';
import { getDatabase } from '@/app/utils/mongodb-client';

const FIRST_LOGINS_KEY = 'first_logins';
const MONGODB_URI = process.env.MONGODB_URI || '';

export async function GET() {
  try {
    // Try to get from KV/MongoDB abstraction first
    const firstLogins = await dbGet<Record<string, string>>(FIRST_LOGINS_KEY);
    let userCount = 0;

    if (firstLogins) {
      // Count unique users from first_logins
      userCount = Object.keys(firstLogins).length;
    } else {
      // Fallback: Count from MongoDB directly
      if (MONGODB_URI) {
        try {
          const db = await getDatabase();
          const collection = db.collection('first_logins');
          userCount = await collection.countDocuments();
          // Don't close connection - it's from shared pool
        } catch (error) {
          console.error('Failed to count users from MongoDB:', error);
        }
      }
    }

    return NextResponse.json({ totalUsers: userCount });
  } catch (error) {
    console.error('Failed to get user count:', error);
    return NextResponse.json({ error: 'Failed to get user count' }, { status: 500 });
  }
}

