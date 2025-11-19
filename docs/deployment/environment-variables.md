# Environment Variables Reference

Complete reference for all environment variables used in Deckster.

## Required Variables

These must be set for the application to function:

### Database

```bash
DATABASE_URL="postgresql://username:password@host:port/database"
```
- **Description**: PostgreSQL connection string
- **Format**: `postgresql://[user[:password]@][host][:port][/dbname][?param1=value1&...]`
- **Example**: `postgresql://postgres:password@localhost:5432/deckster`
- **Where to get**: Your PostgreSQL instance
- **Production**: Use connection pooling (e.g., `?pgbouncer=true` for Vercel)

### NextAuth

```bash
NEXTAUTH_URL="https://yourdomain.com"
```
- **Description**: Canonical URL of your site
- **Development**: `http://localhost:3000`
- **Production**: Your production domain
- **Important**: Must match your OAuth redirect URIs

```bash
NEXTAUTH_SECRET="random-secure-string"
```
- **Description**: Secret for encrypting JWT tokens
- **Generate**: `openssl rand -base64 32`
- **Important**: Keep this secret, never commit to git
- **Production**: Use a different secret than development

### Google OAuth

```bash
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```
- **Description**: OAuth 2.0 credentials from Google Cloud Console
- **Where to get**: [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Credentials
- **Setup guide**: See [Google OAuth Setup](../integrations/google-oauth.md)

### API Endpoints

```bash
NEXT_PUBLIC_API_BASE_URL="https://your-api-url.com"
```
- **Description**: Base URL for Director service API
- **Default**: `https://vibe-decker-agents-mvp10-production.up.railway.app`
- **Note**: `NEXT_PUBLIC_` prefix makes it available in browser

```bash
NEXT_PUBLIC_WS_BASE_URL="wss://your-websocket-url.com"
```
- **Description**: WebSocket URL for real-time communication
- **Default**: `wss://vibe-decker-agents-mvp10-production.up.railway.app`
- **Protocol**: Must use `wss://` (WebSocket Secure) in production

## Optional Variables

These enhance functionality but aren't required:

### Development

```bash
DEV_BYPASS_EMAIL="your-email@example.com"
```
- **Description**: Email address that bypasses approval process
- **Use case**: Local development and testing
- **Security**: Only use in development, never in production
- **Behavior**: Automatically approves this email on sign-in

```bash
NODE_ENV="development"
```
- **Description**: Node environment
- **Values**: `development`, `production`, `test`
- **Auto-set**: Usually set by framework/hosting platform

## Platform-Specific Variables

### Vercel

Vercel automatically sets some variables:
- `VERCEL_URL`: Deployment URL
- `VERCEL_ENV`: Environment (production, preview, development)

You still need to manually set:
- All required variables above
- Use `NEXTAUTH_URL=https://$VERCEL_URL` for automatic URL

### Railway

Railway automatically sets:
- `PORT`: Application port
- `RAILWAY_ENVIRONMENT`: Environment name

Configure all required variables in Railway dashboard.

## Environment Files

### Local Development

Create `.env.local` (gitignored):
```bash
# .env.local (for local development)
DATABASE_URL="postgresql://localhost:5432/deckster"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production"
GOOGLE_CLIENT_ID="your-dev-client-id"
GOOGLE_CLIENT_SECRET="your-dev-client-secret"
DEV_BYPASS_EMAIL="you@example.com"
NEXT_PUBLIC_API_BASE_URL="https://api-staging.example.com"
NEXT_PUBLIC_WS_BASE_URL="wss://ws-staging.example.com"
```

### Example Template

See `.env.example`:
```bash
# .env.example (committed to repo)
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_WS_BASE_URL=
```

## Security Best Practices

1. **Never commit secrets**: Add `.env.local` to `.gitignore`
2. **Use different secrets**: Different values for dev/staging/prod
3. **Rotate regularly**: Change secrets periodically
4. **Limit access**: Only give team members access to secrets they need
5. **Use secret management**: Consider tools like Vault, AWS Secrets Manager

## Validation

The application validates environment variables at startup. Check logs for:
```
[Auth Config] Missing NEXTAUTH_SECRET environment variable
```

Missing required variables will prevent the app from starting.

## Troubleshooting

### "Invalid OAuth Client" Error
- Check `GOOGLE_CLIENT_ID` matches Google Console
- Verify OAuth redirect URIs include your `NEXTAUTH_URL` + `/api/auth/callback/google`

### Database Connection Failed
- Verify `DATABASE_URL` format
- Check PostgreSQL is running
- Test connection: `psql $DATABASE_URL`

### WebSocket Not Connecting
- Check `NEXT_PUBLIC_WS_BASE_URL` is accessible
- Verify `wss://` protocol (not `ws://`) in production
- Check CORS settings on WebSocket server

---

Last updated: 2025-11-18
