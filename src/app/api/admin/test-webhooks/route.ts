import { NextResponse } from 'next/server';
import {
  notifyNewUser,
  notifyUserLogin,
  notifyNewProUser,
  notifyProPurchase,
  notifyConsumablePurchase,
  notifyUserBan,
  notifyUserUnban,
  notifyChatReport,
  notifyItemReport,
} from '@/app/utils/discord-webhook';

const ADMIN_HEADER = 'x-admin-key';

function checkAuth(request: Request): boolean {
  const adminKey = request.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_PRO_TOKEN;
  if (expected && adminKey !== expected) {
    return false;
  }
  return true;
}

/**
 * Test endpoint to verify all Discord webhooks are working
 * GET /api/admin/test-webhooks?adminKey=YOUR_ADMIN_KEY
 */
export async function GET(request: Request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: Record<string, { success: boolean; error?: string }> = {};

    // Test 1: New User
    try {
      await notifyNewUser('76561198000000000', 'Test User');
      results['New User'] = { success: true };
    } catch (error: any) {
      results['New User'] = { success: false, error: error.message };
    }

    // Test 2: User Login (goes to events channel)
    try {
      await notifyUserLogin('76561198000000000', 'Test User');
      results['User Login (Events)'] = { success: true };
    } catch (error: any) {
      results['User Login (Events)'] = { success: false, error: error.message };
    }

    // Test 3: Pro Grant
    try {
      const proUntil = new Date();
      proUntil.setMonth(proUntil.getMonth() + 1);
      await notifyNewProUser('76561198000000000', 1, proUntil.toISOString(), 'Admin Test');
      results['Pro Grant'] = { success: true };
    } catch (error: any) {
      results['Pro Grant'] = { success: false, error: error.message };
    }

    // Test 4: Pro Purchase
    try {
      const proUntil = new Date();
      proUntil.setMonth(proUntil.getMonth() + 1);
      await notifyProPurchase('76561198000000000', 1, 9.99, 'eur', proUntil.toISOString(), 'test_session_123');
      results['Pro Purchase'] = { success: true };
    } catch (error: any) {
      results['Pro Purchase'] = { success: false, error: error.message };
    }

    // Test 5: Consumable Purchase
    try {
      await notifyConsumablePurchase('76561198000000000', 'discord_access', 1, 4.99, 'eur', 'test_session_456');
      results['Consumable Purchase'] = { success: true };
    } catch (error: any) {
      results['Consumable Purchase'] = { success: false, error: error.message };
    }

    // Test 6: User Ban
    try {
      await notifyUserBan('76561198000000000', 'Admin Test');
      results['User Ban'] = { success: true };
    } catch (error: any) {
      results['User Ban'] = { success: false, error: error.message };
    }

    // Test 7: User Unban
    try {
      await notifyUserUnban('76561198000000000', 'Admin Test');
      results['User Unban'] = { success: true };
    } catch (error: any) {
      results['User Unban'] = { success: false, error: error.message };
    }

    // Test 8: Chat Report
    try {
      await notifyChatReport(
        '76561198000000001',
        'Reporter User',
        '76561198000000000',
        'Reported User',
        'global',
        'test_report_123'
      );
      results['Chat Report'] = { success: true };
    } catch (error: any) {
      results['Chat Report'] = { success: false, error: error.message };
    }

    // Test 9: Item Report
    try {
      await notifyItemReport(
        'Test Item',
        'test_item_id',
        'Item is missing from the API',
        false,
        null
      );
      results['Item Report'] = { success: true };
    } catch (error: any) {
      results['Item Report'] = { success: false, error: error.message };
    }

    const allSuccess = Object.values(results).every(r => r.success);
    const successCount = Object.values(results).filter(r => r.success).length;

    return NextResponse.json({
      success: allSuccess,
      message: `Sent ${successCount} out of ${Object.keys(results).length} test notifications`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Test webhooks error:', error);
    return NextResponse.json(
      { error: 'Failed to test webhooks', message: error.message },
      { status: 500 }
    );
  }
}

