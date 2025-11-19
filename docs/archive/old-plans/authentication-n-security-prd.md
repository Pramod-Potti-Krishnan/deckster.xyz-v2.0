# Authentication & Security PRD for Deckster

## Executive Summary

This document outlines the implementation plan for transforming Deckster from a demo application with mock authentication into a production-ready SaaS platform with enterprise-grade security, Google OAuth authentication, and Stripe payment integration.

**Current State**: Mock authentication using localStorage, no payment processing, basic security headers
**Target State**: Production-ready authentication with Google OAuth, Stripe subscriptions, and comprehensive security measures

## Goals & Objectives

1. **Replace mock authentication** with secure, production-ready Google OAuth
2. **Implement payment processing** through Stripe with subscription management
3. **Enhance security** with industry-standard headers, rate limiting, and input validation
4. **Create tiered access** with proper feature gating and usage tracking
5. **Establish secure session management** with JWT tokens and HTTP-only cookies

## Current System Analysis

### Authentication
- **Current**: Mock auth with localStorage storage
- **User Object**: `{ email, name, tier, id }`
- **Session**: Client-side only, no expiration
- **Security**: No password hashing, no server validation

### Payment System
- **Current**: No payment integration
- **Tiers**: UI shows Free/Pro/Enterprise but no actual billing
- **Limits**: Hardcoded presentation limits (3 for free)

### Security
- **Headers**: Basic security headers (HSTS, X-Frame-Options)
- **Missing**: CSP, rate limiting, CSRF protection
- **API**: No authentication on API calls

## Implementation Plan

## Phase 1: Google Authentication System

### 1.1 NextAuth.js Setup
- [x] Install NextAuth.js dependencies
  ```bash
  pnpm add next-auth @auth/prisma-adapter bcryptjs @types/bcryptjs
  ```
- [x] Create NextAuth configuration file
- [x] Set up Google OAuth provider configuration
- [x] Configure JWT strategy for sessions
- [x] Add secure cookie settings

### 1.2 Google Cloud Console Setup
- [ ] Create new project in Google Cloud Console
- [ ] Enable Google+ API
- [ ] Create OAuth 2.0 credentials
- [ ] Add authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google` (development)
  - `https://deckster.xyz/api/auth/callback/google` (production)
- [ ] Obtain Client ID and Client Secret

### 1.3 Authentication API Routes
- [x] Create `/app/api/auth/[...nextauth]/route.ts`
- [x] Configure providers (Google OAuth)
- [x] Set up JWT callbacks for custom claims
- [x] Implement session callbacks
- [ ] Add user creation/update logic

### 1.4 Database Integration
- [ ] Install Prisma
  ```bash
  pnpm add prisma @prisma/client
  ```
- [ ] Create Prisma schema with models:
  - User
  - Account (OAuth accounts)
  - Session
  - Subscription
- [ ] Set up database migrations
- [ ] Create database connection

### 1.5 User Model Updates
- [x] Update TypeScript interfaces:
  ```typescript
  interface User {
    id: string
    email: string
    name: string
    image?: string
    tier: "free" | "pro" | "enterprise"
    subscriptionId?: string
    subscriptionStatus?: "active" | "canceled" | "past_due" | "trialing"
    subscriptionEndDate?: Date
    trialEndsAt?: Date
    createdAt: Date
    updatedAt: Date
  }
  ```
- [x] Create user context provider (SessionProvider)
- [x] Implement useUser hook (useAuth)

### 1.6 Update Authentication Pages
- [x] Replace `/app/auth/signin/page.tsx` with NextAuth signIn
- [x] Update `/app/auth/signup/page.tsx` to redirect to Google OAuth
- [x] Create custom sign-in page with Google button
- [x] Add loading states and error handling
- [x] Implement sign-out functionality

### 1.7 Protected Routes
- [x] Create middleware for route protection
- [x] Implement authentication checks
- [x] Add redirect logic for unauthenticated users
- [ ] Create higher-order component for protected pages
- [x] Update all protected pages (dashboard, builder)

### 1.8 User Profile Menu & Account Management
- [ ] Create profile dropdown menu component
- [ ] Add user avatar with Google profile image
- [ ] Implement profile menu items:
  - [ ] View Profile (name, email, member since)
  - [ ] Account Settings
  - [ ] Billing & Subscription (link to billing page)
  - [ ] Theme Toggle (dark/light mode)
  - [ ] Keyboard Shortcuts
  - [ ] Help & Support
  - [ ] Sign Out
- [ ] Create profile page (`/app/profile/page.tsx`)
  - [ ] Display user information
  - [ ] Edit profile functionality
  - [ ] Change display name
  - [ ] Upload custom avatar
  - [ ] Email preferences
- [ ] Create account settings page (`/app/settings/account/page.tsx`)
  - [ ] Account information
  - [ ] Privacy settings
  - [ ] Data export
  - [ ] Delete account option
- [ ] Add keyboard shortcuts modal
- [ ] Implement theme switching with next-themes
- [ ] Create help/support page with:
  - [ ] Documentation links
  - [ ] Contact support
  - [ ] FAQ
  - [ ] Video tutorials

## Phase 2: Stripe Payment Integration

### 2.1 Stripe Setup
- [ ] Install Stripe dependencies
  ```bash
  pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js
  ```
- [ ] Create Stripe account and obtain API keys
- [ ] Set up products in Stripe Dashboard:
  - Free Tier ($0/month)
  - Pro Tier ($29/month)
  - Enterprise Tier ($99/month)
- [ ] Configure webhooks endpoint

### 2.2 Environment Variables
- [ ] Add to `.env.local`:
  ```
  STRIPE_SECRET_KEY=sk_...
  STRIPE_PUBLISHABLE_KEY=pk_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PRO_PRICE_ID=price_...
  STRIPE_ENTERPRISE_PRICE_ID=price_...
  ```

### 2.3 Pricing Page
- [ ] Create `/app/pricing/page.tsx`
- [ ] Design pricing cards with tier comparison
- [ ] Add feature comparison table
- [ ] Implement "Get Started" and "Upgrade" buttons
- [ ] Add FAQ section

### 2.4 Checkout Flow
- [ ] Create Stripe checkout session API route
- [ ] Implement checkout redirect flow
- [ ] Add success/cancel pages
- [ ] Handle checkout session completion
- [ ] Update user subscription in database

### 2.5 Billing Dashboard
- [ ] Create `/app/billing/page.tsx`
- [ ] Display current subscription status
- [ ] Show next billing date and amount
- [ ] Add payment method management
- [ ] Implement plan upgrade/downgrade
- [ ] Add invoice history
- [ ] Create usage statistics display

### 2.6 Webhook Handler
- [ ] Create `/app/api/webhooks/stripe/route.ts`
- [ ] Handle subscription events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- [ ] Implement signature verification
- [ ] Update database on webhook events

### 2.7 Feature Gating
- [ ] Create feature flag system
- [ ] Implement tier-based access control:
  ```typescript
  const FEATURES = {
    presentations: { free: 3, pro: Infinity, enterprise: Infinity },
    aiAgents: { free: 2, pro: 4, enterprise: 4 },
    customBranding: { free: false, pro: true, enterprise: true },
    teamCollaboration: { free: false, pro: false, enterprise: true },
    advancedAnalytics: { free: false, pro: true, enterprise: true },
    prioritySupport: { free: false, pro: false, enterprise: true }
  }
  ```
- [ ] Add usage tracking
- [ ] Implement limit enforcement
- [ ] Create upgrade prompts

## Phase 3: Security Enhancements

### 3.1 Advanced Security Headers
- [ ] Update `next.config.mjs` with comprehensive headers:
  ```javascript
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.vercel.app *.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' *.railway.app wss: *.stripe.com; frame-src *.stripe.com; font-src 'self' data:;"
  }
  ```
- [ ] Add X-XSS-Protection header
- [ ] Implement Permissions-Policy
- [ ] Add X-Content-Security-Policy
- [ ] Configure Expect-CT header

### 3.2 Input Validation & Sanitization
- [ ] Install validation dependencies
  ```bash
  pnpm add dompurify @types/dompurify validator @types/validator
  ```
- [ ] Create validation schemas with Zod:
  - User input validation
  - API request validation
  - File upload validation
- [ ] Implement HTML sanitization
- [ ] Add SQL injection prevention
- [ ] Create input length limits

### 3.3 Rate Limiting
- [ ] Install rate limiting dependencies
  ```bash
  pnpm add rate-limiter-flexible redis ioredis
  ```
- [ ] Create rate limiting middleware
- [ ] Configure limits by tier:
  - Free: 100 requests/hour
  - Pro: 1,000 requests/hour
  - Enterprise: 10,000 requests/hour
- [ ] Implement WebSocket rate limiting
- [ ] Add rate limit headers

### 3.4 API Security
- [ ] Implement JWT middleware for API routes
- [ ] Add request signing for sensitive operations
- [ ] Create API key management system
- [ ] Implement request validation
- [ ] Add CORS configuration
- [ ] Secure WebSocket connections

### 3.5 Session Security
- [ ] Configure secure session settings:
  ```javascript
  {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
      strategy: "jwt",
      maxAge: 24 * 60 * 60, // 24 hours
    },
    cookies: {
      sessionToken: {
        name: `__Secure-next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true
        }
      }
    }
  }
  ```
- [ ] Implement session invalidation
- [ ] Add concurrent session management
- [ ] Create session activity logging

### 3.6 CSRF Protection
- [ ] Implement CSRF token generation
- [ ] Add CSRF validation middleware
- [ ] Update forms with CSRF tokens
- [ ] Configure double-submit cookie pattern

## Phase 4: Infrastructure & Monitoring

### 4.1 Logging & Monitoring
- [ ] Install monitoring dependencies
  ```bash
  pnpm add winston @sentry/nextjs pino pino-pretty
  ```
- [ ] Configure structured logging
- [ ] Set up error tracking with Sentry
- [ ] Implement performance monitoring
- [ ] Add security event logging
- [ ] Create audit trail for sensitive operations

### 4.2 Environment Configuration
- [ ] Create environment variable validation
- [ ] Implement secret rotation procedures
- [ ] Add development/staging/production configs
- [ ] Create environment variable documentation
- [ ] Implement secure key management

### 4.3 Testing & Quality Assurance
- [ ] Write unit tests for auth flows
- [ ] Create integration tests for payment flows
- [ ] Implement security testing
- [ ] Add E2E tests for critical paths
- [ ] Create load testing scenarios

### 4.4 Documentation
- [ ] Create API documentation
- [ ] Write security best practices guide
- [ ] Document deployment procedures
- [ ] Create troubleshooting guide
- [ ] Add user authentication flow diagrams

## Dependencies Summary

```json
{
  "dependencies": {
    "next-auth": "^4.24.5",
    "@auth/prisma-adapter": "^1.0.12",
    "stripe": "^14.21.0",
    "@stripe/stripe-js": "^2.4.0",
    "@stripe/react-stripe-js": "^2.4.0",
    "prisma": "^5.10.2",
    "@prisma/client": "^5.10.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "rate-limiter-flexible": "^5.0.3",
    "redis": "^4.6.13",
    "ioredis": "^5.3.2",
    "dompurify": "^3.0.8",
    "validator": "^13.11.0",
    "winston": "^3.11.0",
    "pino": "^8.19.0",
    "@sentry/nextjs": "^7.100.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/dompurify": "^3.0.5",
    "@types/validator": "^13.11.8",
    "@types/jsonwebtoken": "^9.0.5"
  }
}
```

## Environment Variables Required

```bash
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/deckster

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Redis (for rate limiting)
REDIS_URL=redis://localhost:6379

# Sentry (for error tracking)
SENTRY_DSN=https://...@sentry.io/...

# API Security
API_SECRET_KEY=your-api-secret
JWT_SECRET=your-jwt-secret
```

## Success Criteria

1. **Authentication**
   - [ ] Users can sign in with Google OAuth
   - [ ] Sessions persist across browser refreshes
   - [ ] Sign out properly clears all session data
   - [ ] Protected routes redirect unauthenticated users

2. **Payments**
   - [ ] Users can subscribe to Pro/Enterprise plans
   - [ ] Subscription changes reflect immediately
   - [ ] Payment failures are handled gracefully
   - [ ] Users can manage billing information

3. **Security**
   - [ ] All security headers pass security audits
   - [ ] Rate limiting prevents API abuse
   - [ ] Input validation prevents XSS/SQL injection
   - [ ] Sessions are secure and tamper-proof

4. **Performance**
   - [ ] Authentication adds < 100ms latency
   - [ ] Payment pages load < 2 seconds
   - [ ] API rate limiting has minimal overhead
   - [ ] Session validation is efficient

## Timeline

- **Week 1-2**: Google Authentication System
- **Week 2-3**: Stripe Payment Integration
- **Week 3-4**: Security Enhancements
- **Week 4-5**: Infrastructure & Monitoring
- **Week 5-6**: Testing & Documentation

## Risk Mitigation

1. **Data Migration**: Create backup of existing user data before migration
2. **Payment Failures**: Implement retry logic and notification system
3. **Security Vulnerabilities**: Regular security audits and penetration testing
4. **Performance Impact**: Load testing before production deployment
5. **User Experience**: A/B testing for authentication and payment flows

## Next Steps

1. Begin with Phase 1.1: Install NextAuth.js dependencies
2. Set up Google Cloud Console project
3. Create development database
4. Implement basic authentication flow
5. Test with small user group before full rollout