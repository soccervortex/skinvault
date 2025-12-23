import { NextResponse } from 'next/server';
import { 
  getProUntil, 
  grantPro, 
  getFirstLoginDate, 
  hasClaimedFreeMonth, 
  markFreeMonthClaimed 
} from '@/app/utils/pro-storage';

// First week free promotion: Users can claim 2 weeks free Pro within 7 days of first login
const FREE_MONTH_DAYS = 7;
const FREE_WEEKS = 2; // 2 weeks = 0.5 months

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

    // Check if user has already claimed the free two weeks (one-time only)
    const alreadyClaimed = await hasClaimedFreeMonth(steamId);
    if (alreadyClaimed) {
      return NextResponse.json({ 
        error: 'You have already claimed your free two weeks trial. This offer is only available once.',
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
        error: `This free trial is only available within the first ${FREE_MONTH_DAYS} days of your first login. Your account is ${Math.floor(daysSinceFirstLogin)} days old.`,
        expired: true,
        daysSinceFirstLogin: Math.floor(daysSinceFirstLogin)
      }, { status: 400 });
    }

    // All checks passed - grant the free two weeks (0.5 months)
    const newProUntil = await grantPro(steamId, 0.5);
    
    // Mark as claimed (one-time only)
    await markFreeMonthClaimed(steamId);

    return NextResponse.json({
      success: true,
      proUntil: newProUntil,
      message: `Congratulations! You've claimed your free two weeks of Pro!`,
    });
  } catch (error) {
    console.error('Failed to claim free two weeks:', error);
    return NextResponse.json({ error: 'Failed to claim free two weeks' }, { status: 500 });
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
      return NextResponse.json({
        eligible: false,
        alreadyClaimed: true,
        message: 'You have already claimed your free two weeks trial. This offer is only available once.',
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
        message: `This free trial is only available within the first ${FREE_MONTH_DAYS} days of your first login. Your account is ${Math.floor(daysSinceFirstLogin)} days old.`,
      });
    }

    // Eligible!
    return NextResponse.json({
      eligible: true,
      hasPro: false,
      daysRemaining,
      message: `You are eligible for two weeks free Pro! ${daysRemaining > 0 ? `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining to claim.` : 'Claim it now!'}`,
    });
  } catch (error) {
    console.error('Failed to check free month eligibility:', error);
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 });
  }
}
