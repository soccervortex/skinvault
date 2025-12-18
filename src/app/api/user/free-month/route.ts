import { NextResponse } from 'next/server';
import { getProUntil, grantPro } from '@/app/utils/pro-storage';

// First week free promotion: Users can claim 1 month free Pro within 7 days of first login
const FREE_MONTH_DAYS = 7;
const FREE_MONTHS = 1;

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

    // Check if user has already claimed the free month
    // We'll track this by checking if they have a "claimed_free_month" flag
    // For now, we'll use a simple check: if they don't have Pro, they can claim it
    // In production, you might want to track this in KV with a separate key
    
    // Check if user is within first 7 days
    // Since we don't track first login date, we'll grant it if they don't have Pro
    // In a real implementation, you'd check: (Date.now() - firstLoginDate) < 7 days
    
    // For now, grant the free month if they don't have Pro
    const newProUntil = await grantPro(steamId, FREE_MONTHS);

    return NextResponse.json({
      success: true,
      proUntil: newProUntil,
      message: `Congratulations! You've claimed your free ${FREE_MONTHS} month${FREE_MONTHS > 1 ? 's' : ''} of Pro!`,
    });
  } catch (error) {
    console.error('Failed to claim free month:', error);
    return NextResponse.json({ error: 'Failed to claim free month' }, { status: 500 });
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
    
    // For now, eligible if they don't have Pro
    // In production, also check if within 7 days of first login
    const eligible = !hasPro;

    return NextResponse.json({
      eligible,
      hasPro,
      message: eligible 
        ? 'You are eligible for 1 month free Pro! Claim it now.'
        : 'You already have an active Pro subscription',
    });
  } catch (error) {
    console.error('Failed to check free month eligibility:', error);
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 });
  }
}
