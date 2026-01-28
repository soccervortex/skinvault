import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isOwnerRequest } from '@/app/utils/admin-auth';

export const runtime = 'nodejs';

function safeHostFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isOwnerRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = String(process.env.VERCEL_TOKEN || '').trim();
  const projectIdOrName = String(process.env.VERCEL_PROJECT_ID || '').trim();
  const teamId = String(process.env.VERCEL_TEAM_ID || '').trim();
  const deployHookUrl = String(process.env.VERCEL_DEPLOY_HOOK_URL || '').trim();

  if (!token || !projectIdOrName) {
    return NextResponse.json(
      {
        error: 'Vercel integration not configured',
        missing: {
          VERCEL_TOKEN: !token,
          VERCEL_PROJECT_ID: !projectIdOrName,
          VERCEL_DEPLOY_HOOK_URL: !deployHookUrl,
        },
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const idx = Number(body?.idx);
  const uri = String(body?.uri || '').trim();
  const targetRaw = body?.target;

  if (!Number.isFinite(idx) || idx < 1 || !Number.isInteger(idx)) {
    return NextResponse.json({ error: 'Invalid idx' }, { status: 400 });
  }
  if (!uri) {
    return NextResponse.json({ error: 'Missing uri' }, { status: 400 });
  }

  const envKey = `MONGODB_CLUSTER_${idx}`;

  const target = Array.isArray(targetRaw) && targetRaw.length
    ? targetRaw.map((t: any) => String(t)).filter((t: string) => ['production', 'preview', 'development'].includes(t))
    : ['production', 'preview'];

  if (!target.length) {
    return NextResponse.json({ error: 'Invalid target list' }, { status: 400 });
  }

  const url = new URL(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectIdOrName)}/env`);
  url.searchParams.set('upsert', 'true');
  if (teamId) url.searchParams.set('teamId', teamId);

  const host = safeHostFromUri(uri);

  // Note: Vercel supports types: system, secret, encrypted, plain, sensitive
  // Use encrypted so the value isn't retrievable via API without decrypt permissions.
  const requestBody = {
    key: envKey,
    value: uri,
    type: 'encrypted',
    target,
    comment: 'Added via SkinVault admin Database Manager',
  };

  let envResponse: any = null;
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    envResponse = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Failed to upsert Vercel env var',
          envKey,
          host,
          status: res.status,
          details: envResponse,
        },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Vercel env request failed', envKey, host }, { status: 500 });
  }

  let deployTriggered = false;
  let deployError: string | null = null;

  if (deployHookUrl) {
    try {
      const hookRes = await fetch(deployHookUrl, { method: 'POST' });
      if (!hookRes.ok) {
        deployError = `Deploy hook failed (HTTP ${hookRes.status})`;
      } else {
        deployTriggered = true;
      }
    } catch (e: any) {
      deployError = e?.message || 'Deploy hook request failed';
    }
  }

  return NextResponse.json({
    success: true,
    envKey,
    host,
    target,
    envUpsert: {
      ok: true,
      // Return only high-level info to avoid leaking secrets.
      createdKey: envResponse?.created?.key || null,
      createdId: envResponse?.created?.id || null,
      failed: Array.isArray(envResponse?.failed) ? envResponse.failed : [],
    },
    deploy: {
      hookConfigured: !!deployHookUrl,
      triggered: deployTriggered,
      error: deployError,
    },
  });
}
