import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    return NextResponse.json({ users: [] });
  } catch (error: any) {
    return NextResponse.json({ users: [], error: error?.message || 'Failed' }, { status: 500 });
  }
}
