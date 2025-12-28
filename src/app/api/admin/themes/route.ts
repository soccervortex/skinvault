import { NextResponse } from 'next/server';
import { getThemeSettings, setThemeEnabled, ThemeType } from '@/app/utils/theme-storage';

const ADMIN_HEADER = 'x-admin-key';

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

    // Read current settings (bypass cache to get fresh data)
    const currentSettings = await getThemeSettings(true);
    
    // Create new settings object
    const newSettings = { ...currentSettings };
    
    // If enabling a theme, disable all other themes first (only one theme active at a time)
    if (enabled) {
      for (const otherTheme of validThemes) {
        if (otherTheme !== theme) {
          newSettings[otherTheme] = { enabled: false };
        }
      }
    }
    
    // Update the specific theme
    newSettings[theme] = { enabled };
    
    // Write all settings at once (more efficient and avoids race conditions)
    const { setThemeSettings } = await import('@/app/utils/theme-storage');
    await setThemeSettings(newSettings);
    
    // Wait a bit to ensure database write completes and propagates
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get fresh settings (ALWAYS bypass cache to ensure we get the latest)
    const updatedSettings = await getThemeSettings(true);

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

    // Broadcast theme change to all users via Pusher for real-time updates
    try {
      const pusherAppId = process.env.PUSHER_APP_ID;
      const pusherSecret = process.env.PUSHER_SECRET;
      const pusherCluster = process.env.PUSHER_CLUSTER || 'eu';

      if (pusherAppId && pusherSecret) {
        const Pusher = (await import('pusher')).default;
        const pusher = new Pusher({
          appId: pusherAppId,
          key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
          secret: pusherSecret,
          cluster: pusherCluster,
          useTLS: true,
        });

        // Get the active theme after the change
        const { getActiveTheme } = await import('@/app/utils/theme-storage');
        const activeTheme = await getActiveTheme(null, true);

        await pusher.trigger('global', 'theme_changed', {
          type: 'theme_changed',
          theme: activeTheme,
          settings: updatedSettings,
          timestamp: Date.now(),
        });
      }
    } catch (pusherError) {
      console.error('Failed to trigger Pusher theme change event:', pusherError);
      // Don't fail the request if Pusher fails
    }

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Failed to update theme setting:', error);
    return NextResponse.json({ error: 'Failed to update theme setting' }, { status: 500 });
  }
}

