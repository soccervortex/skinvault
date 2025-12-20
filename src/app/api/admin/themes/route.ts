import { NextResponse } from 'next/server';
import { getThemeSettings, setThemeEnabled, ThemeType } from '@/app/utils/theme-storage';

const ADMIN_HEADER = 'x-admin-key';
const OWNER_STEAM_ID = '76561199235618867';

// Get all theme settings
export async function GET(request: Request) {
  try {
    // Verify admin (could also check Steam ID in headers if needed)
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getThemeSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to get theme settings:', error);
    return NextResponse.json({ error: 'Failed to get theme settings' }, { status: 500 });
  }
}

// Update theme setting
export async function POST(request: Request) {
  try {
    const adminKey = request.headers.get(ADMIN_HEADER);
    const expected = process.env.ADMIN_PRO_TOKEN;

    if (expected && adminKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const { theme, enabled } = body as { theme: ThemeType; enabled: boolean };

    if (!theme || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const validThemes: ThemeType[] = ['christmas', 'halloween', 'easter', 'sinterklaas', 'newyear', 'oldyear'];
    if (!validThemes.includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    await setThemeEnabled(theme, enabled);
    const updatedSettings = await getThemeSettings();

    // If theme is being disabled, clear gift claims for that theme so users can claim again next year
    if (!enabled) {
      try {
        const { kv } = await import('@vercel/kv');
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
          await kv.del(`theme_gift_claims_2024_${theme}`);
        }
      } catch (error) {
        console.error('Failed to clear gift claims:', error);
        // Continue anyway - theme disable should still work
      }
    }

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Failed to update theme setting:', error);
    return NextResponse.json({ error: 'Failed to update theme setting' }, { status: 500 });
  }
}

