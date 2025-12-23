import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

const CALL_SIGNALS_KEY = 'call_signals'; // Format: { "callId": [{ type: 'offer'|'answer'|'ice-candidate', from, to, data, timestamp }] }

// POST: Send WebRTC signaling data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { callId, type, from, to, data } = body; // type: 'offer' | 'answer' | 'ice-candidate'

    if (!callId || !type || !from || !to || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const signals = await dbGet<Record<string, any[]>>(CALL_SIGNALS_KEY, false) || {};
    
    if (!signals[callId]) {
      signals[callId] = [];
    }

    signals[callId].push({
      type,
      from,
      to,
      data,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 50 signals per call
    if (signals[callId].length > 50) {
      signals[callId] = signals[callId].slice(-50);
    }

    await dbSet(CALL_SIGNALS_KEY, signals);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send signal:', error);
    return NextResponse.json({ error: 'Failed to send signal' }, { status: 500 });
  }
}

// GET: Get signaling data for a call
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    const userId = searchParams.get('userId');
    const lastSignalTime = searchParams.get('lastSignalTime');

    if (!callId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const signals = await dbGet<Record<string, any[]>>(CALL_SIGNALS_KEY, false) || {};
    const callSignals = signals[callId] || [];

    // Filter signals for this user and after lastSignalTime
    const userSignals = callSignals.filter(signal => {
      if (signal.to !== userId) return false;
      if (lastSignalTime && new Date(signal.timestamp) <= new Date(lastSignalTime)) {
        return false;
      }
      return true;
    });

    return NextResponse.json({ signals: userSignals });
  } catch (error) {
    console.error('Failed to get signals:', error);
    return NextResponse.json({ error: 'Failed to get signals' }, { status: 500 });
  }
}

