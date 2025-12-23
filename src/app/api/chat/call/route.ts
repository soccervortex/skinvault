import { NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/app/utils/database';

const ACTIVE_CALLS_KEY = 'active_calls'; // Format: { "callId": { callerId, receiverId, status: 'ringing'|'active'|'ended', startedAt, type: 'voice'|'video' } }

// POST: Initiate a call
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { callerId, receiverId, callType = 'voice' } = body;

    if (!callerId || !receiverId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (callerId === receiverId) {
      return NextResponse.json({ error: 'Cannot call yourself' }, { status: 400 });
    }

    const callId = [callerId, receiverId].sort().join('_') + '_' + Date.now();
    const activeCalls = await dbGet<Record<string, any>>(ACTIVE_CALLS_KEY, false) || {};

    // Check if there's already an active call
    const existingCall = Object.values(activeCalls).find(
      (call: any) =>
        ((call.callerId === callerId && call.receiverId === receiverId) ||
         (call.callerId === receiverId && call.receiverId === callerId)) &&
        call.status === 'ringing'
    );

    if (existingCall) {
      return NextResponse.json({ error: 'Call already in progress' }, { status: 400 });
    }

    activeCalls[callId] = {
      callerId,
      receiverId,
      status: 'ringing',
      type: callType,
      startedAt: new Date().toISOString(),
    };

    await dbSet(ACTIVE_CALLS_KEY, activeCalls);

    return NextResponse.json({
      success: true,
      callId,
      message: 'Call initiated',
    });
  } catch (error) {
    console.error('Failed to initiate call:', error);
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}

// PATCH: Answer or end a call
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { callId, action, userId } = body; // action: 'answer' | 'decline' | 'end'

    if (!callId || !action || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const activeCalls = await dbGet<Record<string, any>>(ACTIVE_CALLS_KEY, false) || {};
    const call = activeCalls[callId];

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Verify user is part of the call
    if (call.callerId !== userId && call.receiverId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'answer') {
      call.status = 'active';
      call.answeredAt = new Date().toISOString();
    } else if (action === 'decline' || action === 'end') {
      call.status = 'ended';
      call.endedAt = new Date().toISOString();
      call.endedBy = userId;
    }

    await dbSet(ACTIVE_CALLS_KEY, activeCalls);

    return NextResponse.json({
      success: true,
      call,
      message: `Call ${action === 'answer' ? 'answered' : action === 'decline' ? 'declined' : 'ended'}`,
    });
  } catch (error) {
    console.error('Failed to update call:', error);
    return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
  }
}

// GET: Get active calls for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const activeCalls = await dbGet<Record<string, any>>(ACTIVE_CALLS_KEY, false) || {};

    // Get calls involving this user
    const userCalls = Object.entries(activeCalls)
      .filter(([_, call]: [string, any]) => 
        (call.callerId === userId || call.receiverId === userId) &&
        call.status !== 'ended'
      )
      .map(([callId, call]: [string, any]) => ({
        callId,
        ...call,
      }));

    return NextResponse.json({ calls: userCalls });
  } catch (error) {
    console.error('Failed to get calls:', error);
    return NextResponse.json({ error: 'Failed to get calls' }, { status: 500 });
  }
}

// DELETE: End a call
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    const userId = searchParams.get('userId');

    if (!callId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const activeCalls = await dbGet<Record<string, any>>(ACTIVE_CALLS_KEY, false) || {};
    const call = activeCalls[callId];

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Verify user is part of the call
    if (call.callerId !== userId && call.receiverId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    call.status = 'ended';
    call.endedAt = new Date().toISOString();
    call.endedBy = userId;

    await dbSet(ACTIVE_CALLS_KEY, activeCalls);

    return NextResponse.json({
      success: true,
      message: 'Call ended',
    });
  } catch (error) {
    console.error('Failed to end call:', error);
    return NextResponse.json({ error: 'Failed to end call' }, { status: 500 });
  }
}

