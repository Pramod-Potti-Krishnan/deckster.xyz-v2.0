# Quick Start Guide

Get Deckster up and running in 5 minutes.

## Prerequisites

- Node.js 18.17+ installed
- pnpm installed (`npm install -g pnpm`)
- PostgreSQL running
- Google OAuth credentials ready

## 5-Minute Setup

### 1. Install (1 minute)

```bash
git clone <repository-url>
cd deckster-frontend
pnpm install
```

### 2. Configure (2 minutes)

Create `.env.local`:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/deckster"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
NEXT_PUBLIC_API_BASE_URL="https://vibe-decker-agents-mvp10-production.up.railway.app"
NEXT_PUBLIC_WS_BASE_URL="wss://vibe-decker-agents-mvp10-production.up.railway.app"
```

### 3. Initialize Database (1 minute)

```bash
npx prisma migrate dev
```

### 4. Start (1 minute)

```bash
pnpm dev
```

Visit: http://localhost:3000

## First Presentation

1. Click "Start Building" on homepage
2. Sign in with Google
3. Wait for approval (or use DEV_BYPASS_EMAIL)
4. Type your presentation topic in chat
5. Watch AI agents collaborate to build slides

## What's Next?

- **Customize**: Edit slides in real-time on the canvas
- **Export**: Download as PowerPoint, PDF, or Google Slides
- **Learn**: Check [Content Guide](content-guide.md) for tips
- **Explore**: Review [Architecture Docs](../architecture/) to understand the system

## Common Issues

**Can't connect to database?**
```bash
createdb deckster  # Create the database
```

**OAuth not working?**
- Add redirect URI in Google Console: `http://localhost:3000/api/auth/callback/google`

**Port 3000 already in use?**
```bash
pnpm dev -- -p 3001  # Use different port
```

## Need Help?

- [Full Environment Setup Guide](environment-setup.md)
- [Troubleshooting](../issues-and-fixes/)
- [Documentation Index](../README.md)

---

Last updated: 2025-11-18
