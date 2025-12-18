# Email Setup Guide for Contact Form

The contact form sends emails to **drmizayt2@gmail.com**. You need to configure an email service.

## Option 1: Resend (Recommended - Free & Easy)

1. **Sign up at**: https://resend.com
2. **Get API Key**: Dashboard → API Keys → Create API Key
3. **Add to Vercel Environment Variables**:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

## Option 2: Gmail SMTP

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create App Password**: 
   - Google Account → Security → 2-Step Verification → App Passwords
   - Generate password for "Mail"
3. **Add to Vercel Environment Variables**:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=your-email@gmail.com
   ```

## Option 3: Other SMTP Services

For services like SendGrid, Mailgun, etc.:

```
SMTP_HOST=smtp.sendgrid.net (or your provider)
SMTP_PORT=587
SMTP_USER=apikey (or your username)
SMTP_PASS=your-api-key
SMTP_FROM=noreply@skinvault.app
```

## Testing

1. **Without Email Service**: The form will work but log to console (for development)
2. **With Email Service**: Emails will be sent to drmizayt2@gmail.com

## Environment Variables to Add in Vercel

Go to: Project → Settings → Environment Variables

Add one of these configurations:

### For Resend:
- `RESEND_API_KEY` = your Resend API key

### For SMTP:
- `SMTP_HOST` = smtp server hostname
- `SMTP_PORT` = 587 or 465
- `SMTP_USER` = your email/username
- `SMTP_PASS` = your password/app password
- `SMTP_FROM` = sender email address

## Notes

- The recipient email is hardcoded to: **drmizayt2@gmail.com**
- Images are attached to the email
- Form includes: reason, name, email, description, and images
- Works on both mobile and desktop
