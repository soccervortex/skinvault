import { NextResponse } from 'next/server';

// Test endpoint to verify callback route is accessible
export async function GET(request: Request) {
  console.log('[Test Callback] ===== TEST CALLBACK ROUTE CALLED =====');
  console.log('[Test Callback] Timestamp:', new Date().toISOString());
  console.log('[Test Callback] Request URL:', request.url);
  
  return NextResponse.json({ 
    success: true, 
    message: 'Callback route is accessible',
    timestamp: new Date().toISOString(),
    url: request.url
  });
}

