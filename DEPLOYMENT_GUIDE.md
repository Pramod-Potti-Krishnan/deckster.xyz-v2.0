# Deployment Guide for Deckster Frontend

## Environment Variables for Production

Configure these environment variables in your hosting platform (Vercel/Railway/Netlify/etc.):

### Required Variables

```bash
# Database Configuration
DATABASE_URL="<your-supabase-postgres-url>"

# NextAuth.js Configuration
# IMPORTANT: Update this to your actual production domain
NEXTAUTH_URL="https://deckster.xyz"  # CHANGE THIS TO YOUR DOMAIN (no trailing slash, no www unless you use it)

# NextAuth Secret (use the one from .env.local)
NEXTAUTH_SECRET="<your-nextauth-secret-from-env-local>"

# Google OAuth Credentials (use the ones from .env.local)
GOOGLE_CLIENT_ID="<your-google-client-id>"
GOOGLE_CLIENT_SECRET="<your-google-client-secret>"

# Layout Service (for PDF/PPTX downloads)
NEXT_PUBLIC_LAYOUT_SERVICE_URL="https://web-production-f0d13.up.railway.app"
```

**Note:** Copy the actual values from your `.env.local` file when configuring your deployment platform.

### Optional Variables (REMOVE in Production)

```bash
# DEV_BYPASS_EMAIL - DO NOT SET THIS IN PRODUCTION
# This bypasses the approval requirement and should only be used in development
```

## Google OAuth Configuration

**CRITICAL:** The redirect URIs must include `/api/` in the path!

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3002` (for development)
   - `https://deckster.xyz` (for production)
4. Under **Authorized redirect URIs**, add (NOTE THE `/api/` IN THE PATH):
   - `http://localhost:3002/api/auth/callback/google` (for development)
   - `https://deckster.xyz/api/auth/callback/google` (for production)
   - **IMPORTANT:** Make sure it's `/api/auth/callback/google`, NOT `/auth/callback/google`
5. Save changes

**Common Error:** If you see 404 errors after clicking "Continue with Google", check that your redirect URI includes `/api/` in the path.

## Vercel Deployment (Recommended)

### 1. Connect Repository
- Go to [Vercel Dashboard](https://vercel.com/dashboard)
- Click "New Project"
- Import your GitHub repository: `Pramod-Potti-Krishnan/deckster.xyz-v2.0`

### 2. Configure Project Settings

**Build & Development Settings:**
- Framework Preset: `Next.js`
- Build Command: `pnpm build` (automatically includes Prisma generation)
- Output Directory: `.next` (default)
- Install Command: `pnpm install` (default)

**Environment Variables:**
Add all the required variables listed above in the "Environment Variables" section.

### 3. Deploy
Click "Deploy" and Vercel will:
- Install dependencies
- Generate Prisma client
- Build the Next.js app
- Deploy to production

## Railway Deployment (Alternative)

### 1. Create New Project
- Go to [Railway Dashboard](https://railway.app/dashboard)
- Click "New Project" → "Deploy from GitHub repo"
- Select your repository

### 2. Configure Build
Add these settings:
- Build Command: `pnpm build` (automatically includes Prisma generation)
- Start Command: `pnpm start`

### 3. Add Environment Variables
Add all required variables in the "Variables" tab.

### 4. Deploy
Railway will automatically deploy on push to main.

## Database Setup (Already Complete)

Your Supabase database is already configured with:
- Authentication tables (`auth_users`, `auth_accounts`)
- Chat session tables (`fe_chat_sessions`, `fe_chat_messages`)
- Session state cache (`fe_session_state_cache`)

**No additional database setup needed!** The schema is already applied.

## Post-Deployment Checklist

- [ ] Verify `NEXTAUTH_URL` is set to production domain
- [ ] Confirm Google OAuth redirect URI includes production domain
- [ ] Remove `DEV_BYPASS_EMAIL` from production environment
- [ ] Test login with Google OAuth
- [ ] Test creating a new presentation
- [ ] Test chat history persistence
- [ ] Test session restoration
- [ ] Verify PDF/PPTX downloads work
- [ ] Check that empty sessions are not saved

## Domain Configuration

If using custom domain (deckster.xyz):
1. Add domain in Vercel/Railway dashboard
2. Update DNS records as instructed by platform
3. Update `NEXTAUTH_URL` environment variable
4. Update Google OAuth authorized redirect URIs

## Monitoring

Check these after deployment:
- Application logs for errors
- Database connections (should see Prisma queries)
- WebSocket connections to Director service
- Google OAuth authentication flow

## Support

If you encounter issues:
1. Check environment variables are correctly set
2. Verify Google OAuth configuration
3. Check database connection (Supabase dashboard)
4. Review application logs in hosting platform

---

**Deployment Date:** 2025-01-11
**Latest Commit:** 9ee6697 - feat: Add comprehensive chat history and session management system
