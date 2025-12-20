import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const ADMIN_HEADER = 'x-admin-key';
const GIFT_CLAIMS_KEY = 'christmas_gift_claims_2025';

export async function POST(request: Request) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear all gift claims from KV
    try {
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        await kv.del(GIFT_CLAIMS_KEY);
      }
    } catch (error) {
      console.error('Failed to clear gift claims:', error);
    }

    return NextResponse.json({ success: true, message: 'Gift claims cleared' });
  } catch (error) {
    console.error('Failed to clear gifts:', error);
    return NextResponse.json({ error: 'Failed to clear gifts' }, { status: 500 });
  }
}

