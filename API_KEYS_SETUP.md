# API Keys & OAuth Setup (SkinVault)

This project uses **Steam OpenID** for authentication and optional OAuth connections for creator social integrations.

## Required Environment Variables

### Core

- `SESSION_SECRET` (or `NEXTAUTH_SECRET`)
  - Used to sign the Steam session cookie and OAuth `state`.

### Twitch (Creator Connect)

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `PUBLIC_ORIGIN`
  - Example: `https://www.skinvaults.online`
  - Must match the exact domain you use in production (avoid `www`/non-`www` mismatches).

### TikTok (Creator Connect)

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `PUBLIC_ORIGIN`
  - Example: `https://www.skinvaults.online`

> Note: There is **no** `TIKTOK_ACCESS_TOKEN` env var in the current implementation. Tokens are stored per creator after they connect via OAuth.

### Optional

- `YOUTUBE_API_KEY`
  - Enables YouTube Data API v3 for more reliable live/latest video.

- `TIKTOK_STATUS_API_BASE_URL`
  - Optional override for the TikTok status fallback API.
  - Default: `http://faashuis.ddns.net:8421`

## Steam OpenID

No API key required.

- Login start: `/api/auth/steam`
- Callback: `/api/auth/steam/callback`
- Session check: `/api/auth/steam/session`

## Twitch OAuth (Connect)

### Twitch Developer Console

In your Twitch app settings:

- Add OAuth Redirect URL:
  - `${PUBLIC_ORIGIN}/api/auth/twitch/callback`

Example (production):

- `https://www.skinvaults.online/api/auth/twitch/callback`

### User Flow

- Owner/admin clicks **Connect Twitch** on `/creator/[slug]`
- Start: `/api/auth/twitch?slug=<slug>`
- Callback: `/api/auth/twitch/callback`

Tokens are stored under:

- `creator_twitch_connection_<slug>`

### Disconnect

- `/api/auth/twitch/disconnect?slug=<slug>`

### Revoked Access Behavior

If the creator revokes access in Twitch, the next snapshot refresh will detect `401/403`, delete the stored token, and the UI will return to **Connect Twitch**.

## TikTok Login Kit (Connect)

### TikTok Developer Portal

Enable **Login Kit** for your app and set:

- Redirect URL:
  - `${PUBLIC_ORIGIN}/api/auth/tiktok/callback`

Example (production):

- `https://www.skinvaults.online/api/auth/tiktok/callback`

Recommended scopes (must be enabled in the portal):

- `user.info.basic`
- `video.list`

### User Flow

- Owner/admin clicks **Connect TikTok** on `/creator/[slug]`
- Start: `/api/auth/tiktok?slug=<slug>`
- Callback: `/api/auth/tiktok/callback`

Tokens are stored under:

- `creator_tiktok_connection_<slug>`

### Disconnect

- `/api/auth/tiktok/disconnect?slug=<slug>`

### Revoked Access Behavior

If the creator revokes access in TikTok, the next snapshot refresh will detect `401/403`, delete the stored token, and the UI will return to **Connect TikTok**.

## Creator Snapshot Behavior

Creator snapshot endpoint:

- `/api/creator/[slug]`

Uses:

- Twitch Helix via OAuth when connected (fallbacks to public methods if not connected)
- TikTok official API `video/list` when connected (fallbacks to the status API for live + latest video URL)
- YouTube Data API v3 when `YOUTUBE_API_KEY` is present (fallbacks to RSS/HTML)

## Troubleshooting

### Redirect mismatch (Twitch/TikTok)

This almost always means the `redirect_uri` doesn’t match exactly.

- Ensure `PUBLIC_ORIGIN` is correct
- Ensure the provider portal has the exact callback URL:
  - `${PUBLIC_ORIGIN}/api/auth/<provider>/callback`

### Connect button not visible

Buttons are only shown if:

- The creator has `partnerSteamId` set, and
- You are either:
  - the matching Steam owner (via Steam session), or
  - an admin (`OWNER_STEAM_IDS`)
