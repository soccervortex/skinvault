# Chat System Setup Guide

## Features Implemented

### ✅ Chat System
- Real-time chat with MongoDB storage
- Messages poll every second for live updates
- User display with Steam avatar, name, and Pro status
- Click on user avatar/name to view their inventory
- Messages automatically clear after 24 hours
- Daily backup system for admins

### ✅ Admin Features
- **Total User Count**: Displayed in admin panel
- **Timeout Users**: 1min, 5min, 30min, 60min, 1day options
- **Ban Users**: Permanent ban from chat
- **View Backups**: Access to chat message backups

## API Endpoints

### Chat Messages
- `GET /api/chat/messages` - Get all messages from last 24 hours
- `POST /api/chat/messages` - Send a new message

### Admin Actions
- `POST /api/chat/timeout` - Timeout a user (requires admin)
- `DELETE /api/chat/timeout?steamId=...&adminSteamId=...` - Remove timeout
- `POST /api/chat/backup` - Manually backup and clear chat (admin only)
- `GET /api/chat/backup?adminSteamId=...` - Get backup history (admin only)
- `POST /api/chat/reset` - Daily reset endpoint (for cron jobs)
- `GET /api/admin/user-count` - Get total user count

## MongoDB Collections

### `chats`
Stores active chat messages (last 24 hours):
```javascript
{
  steamId: string,
  steamName: string,
  avatar: string,
  message: string,
  timestamp: Date,
  isPro: boolean
}
```

### `chat_backups`
Stores daily backups of chat messages:
```javascript
{
  backupDate: Date,
  messageCount: number,
  messages: Array<ChatMessage>
}
```

## Daily Reset Setup

### Option 1: Vercel Cron Jobs (Recommended)

1. Create `vercel.json` in your project root:
```json
{
  "crons": [
    {
      "path": "/api/chat/reset",
      "schedule": "0 0 * * *"
    }
  ]
}
```

2. Add `CRON_SECRET` environment variable in Vercel:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `CRON_SECRET=your-secret-key-here`

3. Update the reset endpoint to use the secret:
   - The endpoint already checks for `CRON_SECRET` in the authorization header

### Option 2: External Cron Service

Use a service like:
- **cron-job.org** (free)
- **EasyCron** (free tier)
- **GitHub Actions** (free)

Set up a daily HTTP request to:
```
POST https://skinvaults.online/api/chat/reset
Authorization: Bearer YOUR_CRON_SECRET
```

## Usage

### For Users
1. Navigate to `/chat` page
2. Sign in with Steam (required)
3. Type messages and send
4. Click on any user's avatar/name to view their inventory
5. See Pro badges on Pro users

### For Admins
1. Go to `/chat` page
2. Hover over any message to see admin actions
3. Click clock icon to timeout user
4. Click ban icon to permanently ban user
5. Use `/api/chat/backup` to manually backup and clear chat
6. View backups via `/api/chat/backup?adminSteamId=YOUR_STEAM_ID`

## Timeout Durations

- `1min` - 1 minute
- `5min` - 5 minutes
- `30min` - 30 minutes
- `60min` - 60 minutes (1 hour)
- `1day` - 24 hours

## Security

- All admin actions require owner Steam ID verification
- Banned users cannot send messages
- Timed out users cannot send messages until timeout expires
- Chat messages are limited to 500 characters
- Only messages from last 24 hours are shown

## Database Requirements

Make sure `MONGODB_URI` and `MONGODB_DB_NAME` are set in your environment variables.

## Testing

1. **Test Chat**:
   - Sign in with Steam
   - Send a message
   - Verify it appears immediately

2. **Test Admin Features**:
   - Sign in as admin
   - Timeout a test user
   - Verify they can't send messages
   - Ban a test user
   - Verify they can't send messages

3. **Test Daily Reset**:
   - Manually call `/api/chat/reset` (with auth)
   - Verify old messages are backed up
   - Verify old messages are cleared

