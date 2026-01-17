import { NextResponse } from 'next/server';
import { 
  getProUntil, 
  grantProDays, 
  getFirstLoginDate, 
  hasClaimedFreeMonth, 
  markFreeMonthClaimed 
} from '@/app/utils/pro-storage';
import { getDatabase, hasMongoConfig } from '@/app/utils/mongodb-client';
import { createUserNotification } from '@/app/utils/user-notifications';

// New user bonus: Users can activate 2 weeks of Pro access within 7 days of first login
const FREE_MONTH_DAYS = 7;
const FREE_WEEKS = 2; // 2 weeks = 0.5 months
const FREE_DAYS = 14;

export async function POST(request: Request) {
  try {
    const { steamId } = await request.json();

    if (!steamId || typeof steamId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid steamId' }, { status: 400 });
    }

    // Check if user already has Pro
    const currentProUntil = await getProUntil(steamId);
    if (currentProUntil && new Date(currentProUntil) > new Date()) {
      return NextResponse.json({ 
        error: 'You already have an active Pro subscription',
        alreadyPro: true 
      }, { status: 400 });
    }

    // Check if user has already claimed the bonus (one-time only)
    const alreadyClaimed = await hasClaimedFreeMonth(steamId);
    if (alreadyClaimed) {
      const nowMs = Date.now();
      const curMs = currentProUntil ? new Date(currentProUntil).getTime() : NaN;
      const isValidCur = Number.isFinite(curMs);
      const recentlyClaimed = isValidCur ? curMs > nowMs - FREE_DAYS * 24 * 60 * 60 * 1000 : true;

      // Repair path: if the user claimed within the last 14 days but ended up expired (historical bug)
      if ((!currentProUntil || (isValidCur && curMs <= nowMs && recentlyClaimed))) {
        const newProUntil = await grantProDays(steamId, FREE_DAYS);

        try {
          if (hasMongoConfig()) {
            const db = await getDatabase();
            await createUserNotification(
              db,
              steamId,
              'pro_bonus_activated',
              'Pro Bonus Activated',
              'Your new user Pro bonus is now active (2 weeks).',
              { proUntil: newProUntil }
            );
          }
        } catch {
        }

        return NextResponse.json({
          success: true,
          proUntil: newProUntil,
          message: 'Success! Your 2-week Pro bonus is now active.',
          repaired: true,
        });
      }

      return NextResponse.json({ 
        error: 'You have already activated the new user Pro bonus. This offer is available once per account.',
        alreadyClaimed: true 
      }, { status: 400 });
    }

    // Check if user is within first 7 days of first login
    const firstLoginDate = await getFirstLoginDate(steamId);
    if (!firstLoginDate) {
      return NextResponse.json({ 
        error: 'Unable to verify your account age. Please try logging in again.',
        noFirstLogin: true 
      }, { status: 400 });
    }

    const firstLogin = new Date(firstLoginDate);
    const now = new Date();
    const daysSinceFirstLogin = (now.getTime() - firstLogin.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceFirstLogin > FREE_MONTH_DAYS) {
      return NextResponse.json({ 
        error: `This new user Pro bonus is only available within the first ${FREE_MONTH_DAYS} days after your first sign-in. Your account is ${Math.floor(daysSinceFirstLogin)} days old.`,
        expired: true,
        daysSinceFirstLogin: Math.floor(daysSinceFirstLogin)
      }, { status: 400 });
    }

    // All checks passed - grant 2 weeks of Pro access
    const newProUntil = await grantProDays(steamId, FREE_DAYS);
    
    // Mark as claimed (one-time only)
    await markFreeMonthClaimed(steamId);

    try {
      if (hasMongoConfig()) {
        const db = await getDatabase();
        await createUserNotification(
          db,
          steamId,
          'pro_bonus_activated',
          'Pro Bonus Activated',
          'Your new user Pro bonus is now active (2 weeks).',
          { proUntil: newProUntil }
        );
      }
    } catch {
    }

    return NextResponse.json({
      success: true,
      proUntil: newProUntil,
      message: `Success! Your 2-week Pro bonus is now active.`,
    });
  } catch (error) {
    console.error('Failed to activate Pro bonus:', error);
    return NextResponse.json({ error: 'Failed to activate Pro bonus' }, { status: 500 });
  }
}

// GET endpoint to check if user is eligible
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const steamId = url.searchParams.get('id');

    if (!steamId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const currentProUntil = await getProUntil(steamId);
    const hasPro = currentProUntil && new Date(currentProUntil) > new Date();
    
    if (hasPro) {
      return NextResponse.json({
        eligible: false,
        hasPro: true,
        message: 'You already have an active Pro subscription',
      });
    }

    // Check if already claimed
    const alreadyClaimed = await hasClaimedFreeMonth(steamId);
    if (alreadyClaimed) {
      const nowMs = Date.now();
      const curMs = currentProUntil ? new Date(currentProUntil).getTime() : NaN;
      const isValidCur = Number.isFinite(curMs);
      const recentlyClaimed = isValidCur ? curMs > nowMs - FREE_DAYS * 24 * 60 * 60 * 1000 : true;
      const looksBugged = !currentProUntil || (isValidCur && curMs <= nowMs && recentlyClaimed);

      if (looksBugged) {
        return NextResponse.json({
          eligible: true,
          hasPro: false,
          alreadyClaimed: true,
          repair: true,
          daysRemaining: 0,
          message: 'Your Pro bonus needs re-activation. Click activate to finish enabling your 2-week bonus.',
        });
      }

      return NextResponse.json({
        eligible: false,
        alreadyClaimed: true,
        message: 'You have already activated the new user Pro bonus. This offer is available once per account.',
      });
    }

    // Check if within 7 days of first login
    const firstLoginDate = await getFirstLoginDate(steamId);
    if (!firstLoginDate) {
      return NextResponse.json({
        eligible: false,
        noFirstLogin: true,
        message: 'Unable to verify your account age. Please try logging in again.',
      });
    }

    const firstLogin = new Date(firstLoginDate);
    const now = new Date();
    const daysSinceFirstLogin = (now.getTime() - firstLogin.getTime()) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, FREE_MONTH_DAYS - Math.floor(daysSinceFirstLogin));

    if (daysSinceFirstLogin > FREE_MONTH_DAYS) {
      return NextResponse.json({
        eligible: false,
        expired: true,
        daysSinceFirstLogin: Math.floor(daysSinceFirstLogin),
        message: `This new user Pro bonus is only available within the first ${FREE_MONTH_DAYS} days after your first sign-in. Your account is ${Math.floor(daysSinceFirstLogin)} days old.`,
      });
    }

    // Eligible!
    return NextResponse.json({
      eligible: true,
      hasPro: false,
      daysRemaining,
      message: `You are eligible for a 2-week Pro bonus. ${daysRemaining > 0 ? `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining to activate.` : 'Activate it now!'}`,
    });
  } catch (error) {
    console.error('Failed to check free month eligibility:', error);
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 });
  }
}
