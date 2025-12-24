/**
 * Statsig Initialization API Route
 * Initializes Statsig server-side for the application
 */

import { NextResponse } from 'next/server';
import { initializeStatsig } from '@/app/lib/statsig';

// Initialize Statsig on module load
let initialized = false;

export async function GET() {
  try {
    if (!initialized) {
      await initializeStatsig();
      initialized = true;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Statsig initialized' 
    });
  } catch (error) {
    console.error('Statsig initialization error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize Statsig' 
      },
      { status: 500 }
    );
  }
}

