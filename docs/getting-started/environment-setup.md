# Environment Setup

Guide for setting up your local development environment for Deckster.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.17 or later
- **pnpm**: Package manager (`npm install -g pnpm`)
- **PostgreSQL**: Version 13 or later (local or cloud instance)
- **Git**: For version control
- **Google Cloud Platform Account**: For OAuth credentials

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd deckster-frontend
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/deckster"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Development bypass (optional - allows specific email without approval)
DEV_BYPASS_EMAIL="your-dev-email@example.com"

# API Endpoints
NEXT_PUBLIC_API_BASE_URL="https://vibe-decker-agents-mvp10-production.up.railway.app"
NEXT_PUBLIC_WS_BASE_URL="wss://vibe-decker-agents-mvp10-production.up.railway.app"
```

### 4. Set Up Database

Initialize the database with Prisma:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed the database
npx prisma db seed
```

### 5. Verify Setup

Start the development server:

```bash
pnpm dev
```

Visit `http://localhost:3000` - you should see the landing page.

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - Your production URL + `/api/auth/callback/google`

For detailed OAuth setup, see [Google OAuth Setup Guide](../integrations/google-oauth.md).

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `psql -V`
- Check DATABASE_URL format
- Ensure database exists: `createdb deckster`

### OAuth Issues
- Verify redirect URIs in Google Console
- Check NEXTAUTH_SECRET is set
- Ensure NEXTAUTH_URL matches your domain

### Build Issues
- Clear Next.js cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`
- Check Node.js version: `node -v` (should be 18.17+)

## Next Steps

After successful setup:
1. Review the [Content Guide](content-guide.md)
2. Explore the [Architecture Documentation](../architecture/)
3. Try building your first presentation in `/builder`

---

Last updated: 2025-11-18
