# Deployment Guides

Production deployment documentation for various hosting platforms.

## Available Guides

- [Vercel Deployment](vercel.md) - Deploy to Vercel (recommended platform)
- [Railway Deployment](railway.md) - Deploy to Railway
- [Environment Variables](environment-variables.md) - Configure production environment

## Platform Recommendations

### Vercel (Recommended)
- Best Next.js integration
- Automatic deployments from Git
- Edge network for optimal performance
- Easy environment variable management

### Railway
- Good for full-stack deployments
- Built-in PostgreSQL database
- Simple pricing model

## Pre-Deployment Checklist

Before deploying to production:
- [ ] Database migrations are up to date
- [ ] Environment variables are configured
- [ ] Google OAuth redirect URIs include production domain
- [ ] NEXTAUTH_SECRET is set to a secure random value
- [ ] API endpoints are configured for production URLs
- [ ] Build succeeds locally (`pnpm build`)

## Environment Variables

Required for all platforms:
```bash
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_WS_BASE_URL=
```

See [environment-variables.md](environment-variables.md) for detailed descriptions.

---

[Back to Documentation Index](../README.md)
