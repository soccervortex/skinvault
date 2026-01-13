import { NextRequest, NextResponse } from 'next/server';
import { recordFirstLogin } from '@/app/utils/pro-storage';
import { updateUserCount } from '@/app/lib/user-milestones';
import { notifyNewUser, notifyUserLogin } from '@/app/utils/discord-webhook';
import { getDatabase } from '@/app/utils/mongodb-client';

/**
 * Get Steam username from Steam ID using Steam API
 */
async function getSteamUsername(steamId: string): Promise<string | null> {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      console.warn('[First Login] STEAM_API_KEY not configured, cannot fetch username');
      return null;
    }

    // Use Steam API GetPlayerSummaries
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
    
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('[First Login] Failed to fetch Steam username:', response.status);
      return null;
    }

    const data = await response.json();
    const players = data.response?.players;
    
    if (players && players.length > 0) {
      return players[0].personaname || players[0].realname || null;
    }

    return null;
  } catch (error) {
    console.error('[First Login] Error fetching Steam username:', error);
    return null;
  }
}

// Record first login date when user logs in via Steam
export async function POST(request: Request) {
  try {
    const { steamId, steamName } = await request.json();

    if (!steamId || typeof steamId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid steamId' }, { status: 400 });
    }

    // Validate Steam ID format (should be numeric, 17 digits)
    if (!/^\d{17}$/.test(steamId)) {
      console.warn('Invalid Steam ID format:', steamId);
      return NextResponse.json({ error: 'Invalid Steam ID format' }, { status: 400 });
    }

    // Fetch Steam username if not provided
    let finalSteamName = steamName;
    if (!finalSteamName || finalSteamName === 'Unknown') {
      const fetchedName = await getSteamUsername(steamId);
      if (fetchedName) {
        finalSteamName = fetchedName;
      }
    }

    // Record first login (only records if not already recorded)
    const isNewUser = await recordFirstLogin(steamId);

    try {
      if (isNewUser) {
        const req = request as NextRequest;
        const affCookieRaw = req.cookies?.get('sv_aff')?.value;
        if (affCookieRaw) {
          const parsed = JSON.parse(decodeURIComponent(affCookieRaw));
          const referrerSteamId = String(parsed?.aff || '').trim();
          if (/^\d{17}$/.test(referrerSteamId) && referrerSteamId !== steamId) {
            const db = await getDatabase();
            await db.collection('affiliate_referrals').updateOne(
              { _id: steamId } as any,
              {
                $setOnInsert: {
                  _id: steamId,
                  referredSteamId: steamId,
                  referrerSteamId,
                  createdAt: new Date(),
                  landing: parsed?.landing ? String(parsed.landing).slice(0, 500) : undefined,
                  ts: Number(parsed?.ts) || undefined,
                },
              } as any,
              { upsert: true }
            );
          }
        }
      }
    } catch {}

    // Analytics: steam_login + (optional) first_login attribution
    try {
      const req = request as NextRequest;
      const db = await getDatabase();
      const attributions = db.collection('creator_attribution');
      const refCookieRaw = req.cookies?.get('sv_ref')?.value;

      let refSlug: string | null = null;
      let utm: any | null = null;
      if (refCookieRaw) {
        try {
          const parsed = JSON.parse(decodeURIComponent(refCookieRaw));
          if (parsed?.ref) refSlug = String(parsed.ref).toLowerCase();
          utm = parsed || null;
        } catch {
          // ignore
        }
      }
      if (!refSlug) {
        const existing = await attributions.findOne({ steamId });
        if (existing?.refSlug) refSlug = String(existing.refSlug);
        if (!utm && existing?.utm) utm = existing.utm;
      }

      if (refSlug) {
        await attributions.updateOne(
          { steamId },
          {
            $set: {
              steamId,
              refSlug,
              utm,
              lastSeenAt: new Date(),
            },
            $setOnInsert: { firstSeenAt: new Date() },
          },
          { upsert: true },
        );
      }

      const now = new Date();
      const baseDoc = {
        createdAt: now,
        day: now.toISOString().slice(0, 10),
        steamId,
        refSlug,
        utm: utm ? {
          utm_source: utm?.utm_source,
          utm_medium: utm?.utm_medium,
          utm_campaign: utm?.utm_campaign,
          utm_content: utm?.utm_content,
          utm_term: utm?.utm_term,
          landing: utm?.landing,
          ts: utm?.ts,
        } : undefined,
      };

      await db.collection('analytics_events').insertOne({
        ...baseDoc,
        event: 'steam_login',
        metadata: {
          steamName: finalSteamName || undefined,
          isNewUser,
        },
      });

      if (isNewUser) {
        await db.collection('analytics_events').insertOne({
          ...baseDoc,
          event: 'first_login',
          metadata: {
            steamName: finalSteamName || undefined,
          },
        });
      }
    } catch {
      // analytics should never block login
    }
    
    // Update user count if this is a new user
    if (isNewUser) {
      await updateUserCount();
      
      // Send Discord notification for new user
      notifyNewUser(steamId, finalSteamName).catch(error => {
        console.error('Failed to send new user notification:', error);
      });
    } else {
      // Send Discord notification for regular login (existing user)
      notifyUserLogin(steamId, finalSteamName).catch(error => {
        console.error('Failed to send login notification:', error);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record first login:', error);
    return NextResponse.json({ error: 'Failed to record first login' }, { status: 500 });
  }
}
