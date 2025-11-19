# Google OAuth Setup Guide for Deckster

## Prerequisites
- Google account
- Access to Google Cloud Console

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown in the top bar
3. Click "New Project"
4. Enter project details:
   - **Project name**: Deckster
   - **Organization**: Leave as is
   - Click "Create"

### 2. Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 3. Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace account)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Deckster
   - **User support email**: Your email
   - **App logo**: Upload your logo (optional)
   - **Application home page**: https://deckster.xyz
   - **Application privacy policy**: https://deckster.xyz/privacy
   - **Application terms of service**: https://deckster.xyz/terms
   - **Authorized domains**: deckster.xyz
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. On the Scopes page:
   - Click "Add or Remove Scopes"
   - Select:
     - `../auth/userinfo.email`
     - `../auth/userinfo.profile`
   - Click "Update"
   - Click "Save and Continue"
7. Add test users (if in testing mode):
   - Add your email and any test emails
   - Click "Save and Continue"
8. Review and click "Back to Dashboard"

### 4. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application" as the application type
4. Configure the OAuth client:
   - **Name**: Deckster Web Client
   - **Authorized JavaScript origins**:
     - http://localhost:3000 (for development)
     - https://deckster.xyz (for production)
   - **Authorized redirect URIs**:
     - http://localhost:3000/api/auth/callback/google (for development)
     - https://deckster.xyz/api/auth/callback/google (for production)
5. Click "Create"
6. **IMPORTANT**: Copy your credentials:
   - Client ID: `GOOGLE_CLIENT_ID`
   - Client Secret: `GOOGLE_CLIENT_SECRET`

### 5. Update Environment Variables

Add these to your `.env.local` file:

```env
# Authentication
NEXTAUTH_URL=http://localhost:3000  # Change to https://deckster.xyz in production
NEXTAUTH_SECRET=your-secret-key-min-32-chars  # Generate with: openssl rand -base64 32
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### 6. Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

### 7. Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```
2. Navigate to http://localhost:3000/auth/signin
3. Click "Continue with Google"
4. You should be redirected to Google's OAuth consent screen
5. After authorization, you should be redirected back to your app

## Production Deployment

When deploying to production:

1. Update environment variables in Vercel:
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add all the OAuth variables
   - Set `NEXTAUTH_URL` to `https://deckster.xyz`

2. Update Google OAuth settings:
   - Add production URLs to authorized origins and redirect URIs
   - Ensure your domain is verified

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**
   - Check that your redirect URI exactly matches what's in Google Cloud Console
   - Include the full path: `/api/auth/callback/google`
   - Ensure no trailing slashes

2. **"Invalid client" error**
   - Verify your Client ID and Client Secret are correct
   - Check that they're properly set in environment variables
   - Restart your development server after changing env vars

3. **"Access blocked" error**
   - Make sure Google+ API is enabled
   - Check OAuth consent screen is configured
   - Verify your domain is added to authorized domains

### Security Best Practices

1. **Never commit secrets**: Keep `.env.local` in `.gitignore`
2. **Use different credentials**: Separate development and production OAuth apps
3. **Restrict domains**: Only add your actual domains to authorized lists
4. **Regular audits**: Review OAuth app permissions periodically

## Next Steps

After completing OAuth setup:
1. Test sign-in flow thoroughly
2. Implement user profile management
3. Add role-based access control
4. Set up user data persistence
5. Implement session management

## Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)