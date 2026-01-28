import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminAccess } from '@/app/utils/admin-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const access = await getAdminAccess(req);
  const res = NextResponse.json({ ok: true, access }, { status: 200 });
  res.headers.set('cache-control', 'no-store');
  return res;
}
