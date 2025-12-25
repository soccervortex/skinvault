# Environment Variables Setup for Reviews

## Required Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://yjqmyisfllfurendwtdg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcW15aXNmbGxmdXJlbmR3dGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjQxNTEsImV4cCI6MjA4MjEwMDE1MX0.2lI0dc8F9ceYruQpXg9SgkCCCJWt1Hl9DgMOvDXdAKY
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

