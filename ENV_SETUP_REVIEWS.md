# Environment Variables Setup for Reviews

## Required Environment Variables

### For Next.js (`.env.local`):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://yjqmyisfllfurendwtdg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcW15aXNmbGxmdXJlbmR3dGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjQxNTEsImV4cCI6MjA4MjEwMDE1MX0.2lI0dc8F9ceYruQpXg9SgkCCCJWt1Hl9DgMOvDXdAKY
```

### For Python Server (`server.py` - `.env` file):

```env
# Supabase Configuration
SUPABASE_URL=https://yjqmyisfllfurendwtdg.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcW15aXNmbGxmdXJlbmR3dGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjQxNTEsImV4cCI6MjA4MjEwMDE1MX0.2lI0dc8F9ceYruQpXg9SgkCCCJWt1Hl9DgMOvDXdAKY

# Optional: Override URLs (defaults provided)
TRUSTPILOT_URL=https://nl.trustpilot.com/review/skinvaults.online
SITEJABBER_URL=https://www.sitejabber.com/reviews/skinvaults.online

# Optional: Server port (default: 5000)
SERVER_PORT=5000
```

### For X (Twitter) API Integration (`.env.local`):

```env
# X (Twitter) API OAuth 1.0a Credentials (Required for posting)
# Get these from: https://developer.twitter.com/en/portal/dashboard
# App Type: "Web App, Automated App or Bot"
# App Permissions: "Read and write"
X_API_KEY=your_api_key_here
X_API_SECRET=your_api_secret_here
X_ACCESS_TOKEN=your_access_token_here
X_ACCESS_TOKEN_SECRET=your_access_token_secret_here

# Alternative: You can use X_APISECRET instead of X_API_SECRET
# X_APISECRET=your_api_secret_here
```

## Supabase Table Structure

Your `reviews` table should have the following columns:

- `id` (text/string) - Primary key
- `source` (text/string) - Review source (e.g., "Trustpilot")
- `rating` (integer) - Rating from 1-5
- `reviewer_name` (text/string) - Name of the reviewer
- `review_text` (text/string) - The review content
- `review_date` (timestamp/date) - Date when review was published
- `verified` (boolean) - Whether the review is verified
- `reviewer_avatar` (text/string, optional) - URL to reviewer avatar

## Notes

- The `NEXT_PUBLIC_` prefix is required for client-side access
- Make sure your Supabase table has Row Level Security (RLS) policies that allow read access
- The API route uses server-side Supabase client, so it can use service role key if needed (not recommended for public APIs)

## X (Twitter) API Setup Instructions

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create or select your app
3. Configure your app settings:
   - **App Permissions**: Select "Read and write"
   - **Type of App**: Select "Web App, Automated App or Bot"
   - **Callback URI**: `https://www.skinvaults.online/auth/callback` (or any valid URL)
   - **Website URL**: `https://www.skinvaults.online`
4. Go to "Keys and tokens" tab
5. Copy the following credentials:
   - **API Key** → `X_API_KEY`
   - **API Secret** → `X_API_SECRET` (or `X_APISECRET`)
   - **Access Token** → `X_ACCESS_TOKEN`
   - **Access Token Secret** → `X_ACCESS_TOKEN_SECRET`
6. If you changed app permissions, you may need to regenerate Access Token and Access Token Secret
7. Add all 4 credentials to your `.env.local` file (for local) and Vercel environment variables (for production)

