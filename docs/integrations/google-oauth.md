# Google OAuth Authentication Setup Guide

This guide will help you set up Google OAuth authentication with manual user approval for deckster.

## Overview

The authentication system includes:
- **Google OAuth 2.0** for sign-in/sign-up
- **Supabase PostgreSQL** database for persistent user storage
- **Manual approval workflow** for controlling access
- **Dev bypass** for testing without approval
- **Admin panel** for approving users

---

## Step 1: Set Up Google Cloud OAuth Credentials (15 minutes)

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `deckster` (or your preferred name)
4. Click "Create"

### 1.2 Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click "Create"
4. Fill in the required information:
   - **App name**: deckster
   - **User support email**: your email
   - **Developer contact email**: your email
5. Click "Save and Continue"
6. Skip "Scopes" (click "Save and Continue")
7. Add test users (your email) in development
8. Click "Save and Continue"

### 1.3 Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click "+ Create Credentials" → "OAuth client ID"
3. Select **Application type**: Web application
4. **Name**: deckster Web Client
5. **Authorized JavaScript origins**:
   - `http://localhost:3002` (development)
   - `https://yourdomain.com` (production - add later)
6. **Authorized redirect URIs**:
   - `http://localhost:3002/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production - add later)
7. Click "Create"
8. **IMPORTANT**: Copy your **Client ID** and **Client Secret** - you'll need these!

---

## Step 2: Set Up Supabase Database (10 minutes)

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create an account (or sign in)
4. Click "New project"
5. Fill in:
   - **Name**: deckster
   - **Database Password**: (generate a strong password)
   - **Region**: Choose closest to you
6. Click "Create new project"
7. Wait for project to be provisioned (~2 minutes)

### 2.2 Get Database Connection String

1. In your Supabase project dashboard, click "Project Settings" (gear icon)
2. Navigate to **Database** section
3. Scroll to "Connection string" section
4. Select **URI** tab
5. Copy the connection string
6. Replace `[YOUR-PASSWORD]` with your database password from step 2.1

The connection string format:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

## Step 3: Configure Environment Variables (5 minutes)

### 3.1 Create `.env.local` File

In the root of your project, create a file named `.env.local` (this file is git-ignored):

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3002"
NEXTAUTH_SECRET="[GENERATE-THIS]"

# Google OAuth
GOOGLE_CLIENT_ID="[YOUR-CLIENT-ID].apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="[YOUR-CLIENT-SECRET]"

# Development Bypass (your email for testing)
DEV_BYPASS_EMAIL="your-email@example.com"
```

### 3.2 Generate NEXTAUTH_SECRET

Run this command in your terminal:

```bash
openssl rand -base64 32
```

Copy the output and paste it as your `NEXTAUTH_SECRET`.

### 3.3 Fill in Values

Replace the placeholders:
- `[YOUR-PASSWORD]`: Your Supabase database password
- `[PROJECT-REF]`: Your Supabase project reference (from connection string)
- `[GENERATE-THIS]`: The secret you generated
- `[YOUR-CLIENT-ID]`: Google OAuth Client ID
- `[YOUR-CLIENT-SECRET]`: Google OAuth Client Secret
- `your-email@example.com`: Your email for dev bypass

---

## Step 4: Initialize Database Schema (5 minutes)

### 4.1 Install Prisma CLI (if needed)

```bash
npm install prisma --save-dev
```

### 4.2 Push Schema to Database

```bash
npx prisma db push
```

This will create all the necessary tables in your Supabase database.

### 4.3 Generate Prisma Client

```bash
npx prisma generate
```

### 4.4 Verify Database

Check your Supabase dashboard:
1. Go to **Table Editor**
2. You should see these tables:
   - `auth_accounts`
   - `auth_sessions`
   - `auth_users`
   - `auth_verification_tokens`

---

## Step 5: Test Authentication (10 minutes)

### 5.1 Start Development Server

```bash
npm run dev
```

### 5.2 Test Sign-Up Flow

1. Open `http://localhost:3002`
2. Click "Get Started" or "Sign In"
3. Click "Continue with Google"
4. Sign in with your Google account (use your DEV_BYPASS_EMAIL)
5. You should be redirected to `/builder` (since you're using dev bypass)

### 5.3 Test Pending User Flow

1. Sign out
2. Sign in with a **different Google account** (not your DEV_BYPASS_EMAIL)
3. You should be redirected to `/auth/pending` page
4. This user needs manual approval

---

## Step 6: Approve Users (Admin Panel)

### 6.1 Access Admin Panel

1. Sign in with your DEV_BYPASS_EMAIL account
2. Navigate to `/admin/users`
3. You'll see all users and their approval status

### 6.2 Approve a User

1. Find the pending user
2. Click "Approve" button
3. User is now approved and can access the builder

### 6.3 Revoke Access

1. Find an approved user
2. Click "Revoke" button
3. User will be redirected to pending page next time they try to access builder

---

## Step 7: Manual Database Approval (Alternative)

If you prefer to approve users directly in the database:

### 7.1 Open Supabase SQL Editor

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Create a new query

### 7.2 Approve User by Email

```sql
UPDATE auth_users
SET
  approved = true,
  approved_at = NOW(),
  approved_by = 'manual-admin'
WHERE email = 'user@example.com';
```

### 7.3 List Pending Users

```sql
SELECT id, email, name, created_at
FROM auth_users
WHERE approved = false
ORDER BY created_at DESC;
```

### 7.4 List All Users

```sql
SELECT
  id,
  email,
  name,
  approved,
  approved_at,
  created_at
FROM auth_users
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Issue: "Error 401: Unauthorized"

**Cause**: Google OAuth credentials not configured
**Solution**:
1. Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env.local`
2. Restart development server: `npm run dev`

### Issue: "Error: Prisma Client not initialized"

**Cause**: Prisma client not generated
**Solution**:
```bash
npx prisma generate
npm run dev
```

### Issue: "Database connection failed"

**Cause**: Incorrect DATABASE_URL
**Solution**:
1. Check `DATABASE_URL` in `.env.local`
2. Verify password and project reference are correct
3. Test connection with Prisma:
```bash
npx prisma db push
```

### Issue: "Redirect URI mismatch"

**Cause**: Redirect URI not configured in Google Cloud Console
**Solution**:
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Add redirect URI: `http://localhost:3002/api/auth/callback/google`
4. Save changes

### Issue: "DEV_BYPASS_EMAIL not working"

**Cause**: Email doesn't match exactly
**Solution**:
1. Check `.env.local` for typos
2. Make sure email matches your Google account email exactly
3. Restart dev server

---

## Security Notes

### Production Deployment

When deploying to production:

1. **Update NEXTAUTH_URL**:
   ```env
   NEXTAUTH_URL="https://yourdomain.com"
   ```

2. **Add Production Redirect URI** in Google Cloud Console:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```

3. **Remove DEV_BYPASS_EMAIL** (or set to production admin email):
   ```env
   # For production, only use your admin email
   DEV_BYPASS_EMAIL="admin@yourdomain.com"
   ```

4. **Set secure environment variables** in your hosting platform:
   - Vercel: Project Settings → Environment Variables
   - Railway: Project → Variables
   - Netlify: Site Settings → Environment Variables

5. **Verify OAuth Consent Screen** is published (not in testing mode)

### Best Practices

- ✅ Never commit `.env.local` to git (already in `.gitignore`)
- ✅ Use strong, unique `NEXTAUTH_SECRET` (32+ characters)
- ✅ Regularly rotate secrets in production
- ✅ Only use DEV_BYPASS_EMAIL in development
- ✅ Review and approve users promptly
- ✅ Monitor failed login attempts

---

## Next Steps

Once authentication is set up:

1. **Test thoroughly** with different Google accounts
2. **Approve your team members** via admin panel
3. **Monitor the pending users** page
4. **Integrate with Stripe** (when ready) for payment-based access
5. **Set up email notifications** for new user signups (optional)

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review logs in development: Check browser console and terminal
- Inspect database: Use Supabase Table Editor
- Test OAuth flow: Use Google Cloud Console OAuth Playground

---

**Authentication is now set up! Users must be manually approved before accessing the builder.**
