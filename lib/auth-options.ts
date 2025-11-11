import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter } from "next-auth/adapters"
import { prisma } from "./prisma"

// Validate required environment variables (only at runtime, not during build)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'development') {
  // Only validate in production runtime (not during build)
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

  if (!isBuildTime) {
    if (!process.env.NEXTAUTH_SECRET) {
      console.error('[Auth Config] Missing NEXTAUTH_SECRET environment variable')
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('[Auth Config] Missing GOOGLE_CLIENT_ID environment variable')
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      console.error('[Auth Config] Missing GOOGLE_CLIENT_SECRET environment variable')
    }
    if (!process.env.DATABASE_URL) {
      console.error('[Auth Config] Missing DATABASE_URL environment variable')
    }
  }
}

// Helper function to get session duration based on user preference
function getSessionMaxAge(req?: any): number {
  // Default to 24 hours
  const defaultMaxAge = 24 * 60 * 60;
  // Extended to 30 days
  const extendedMaxAge = 30 * 24 * 60 * 60;
  
  // Check if we can access the preference from the request
  // This will be set during the sign-in process
  if (req?.cookies?.staySignedIn === 'true') {
    return extendedMaxAge;
  }
  
  return defaultMaxAge;
}

// Debug logging for production
console.log('[Auth Config] Environment check:', {
  hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
  nextAuthUrl: process.env.NEXTAUTH_URL,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV,
})

export const authOptions: NextAuthOptions = {
  // Secret for JWT encryption (required by NextAuth)
  secret: process.env.NEXTAUTH_SECRET,
  // Use Prisma adapter for database storage
  adapter: PrismaAdapter(prisma) as Adapter,
  // Trust host in production (required for Vercel)
  trustHost: true,
  // Use secure cookies in production
  useSecureCookies: process.env.NODE_ENV === 'production',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/", // Direct to landing page for sign in
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      console.log('🟢🟢🟢 [Auth JWT] =============== JWT CALLBACK START ===============')
      console.log('🟢 [Auth JWT] Timestamp:', new Date().toISOString())
      console.log('🟢 [Auth JWT] Trigger:', trigger)
      console.log('🟢 [Auth JWT] Has account?', !!account)
      console.log('🟢 [Auth JWT] Has user?', !!user)
      console.log('🟢 [Auth JWT] User email:', user?.email)
      console.log('🟢 [Auth JWT] Token keys:', Object.keys(token))

      try {
        // Initial sign in
        if (account && user) {
          console.log('✅ [Auth JWT] Initial sign in detected for:', user.email)
          console.log('🔍 [Auth JWT] Fetching user from database...')

          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email! },
              select: { id: true, approved: true, tier: true }
            })

            console.log('🔍 [Auth JWT] DB query completed')
            console.log('🔍 [Auth JWT] DB user found?', !!dbUser)

            if (dbUser) {
              console.log('✅ [Auth JWT] DB user data:', {
                id: dbUser.id,
                approved: dbUser.approved,
                tier: dbUser.tier
              })
            } else {
              console.log('⚠️  [Auth JWT] User not found in database:', user.email)
            }

            const newToken = {
              ...token,
              id: dbUser?.id || user.id,
              tier: dbUser?.tier || "free",
              approved: dbUser?.approved || false,
              subscriptionStatus: null,
              exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
            }

            console.log('✅ [Auth JWT] Created new token with data:', {
              id: newToken.id,
              tier: newToken.tier,
              approved: newToken.approved,
              exp: newToken.exp,
              expReadable: new Date(newToken.exp * 1000).toISOString()
            })
            console.log('🟢🟢🟢 [Auth JWT] =============== JWT CALLBACK END (SUCCESS) ===============')

            return newToken
          } catch (dbError) {
            console.error('❌❌❌ [Auth JWT] DATABASE ERROR:', dbError)
            console.error('❌ [Auth JWT] Error name:', (dbError as Error).name)
            console.error('❌ [Auth JWT] Error message:', (dbError as Error).message)
            console.error('❌ [Auth JWT] Error stack:', (dbError as Error).stack)

            // Create a fallback token to prevent complete failure
            console.log('⚠️  [Auth JWT] Creating fallback token without DB data')
            const fallbackToken = {
              ...token,
              id: user.id,
              tier: "free" as const,
              approved: false, // Default to false for safety
              subscriptionStatus: null,
              exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
            }
            console.log('🟢🟢🟢 [Auth JWT] =============== JWT CALLBACK END (FALLBACK) ===============')
            return fallbackToken
          }
        }

        console.log('🔵 [Auth JWT] Not initial sign in, returning existing token')
        console.log('🟢🟢🟢 [Auth JWT] =============== JWT CALLBACK END (EXISTING TOKEN) ===============')
        return token
      } catch (error) {
        console.error('❌❌❌ [Auth JWT] FATAL JWT CALLBACK ERROR:', error)
        console.error('❌ [Auth JWT] Error type:', typeof error)
        console.error('❌ [Auth JWT] Error details:', JSON.stringify(error, null, 2))
        console.log('🟢🟢🟢 [Auth JWT] =============== JWT CALLBACK END (ERROR) ===============')
        throw error
      }
    },
    async session({ session, token }) {
      try {
        console.log('[Auth] Session callback triggered for:', session.user?.email)
        if (session.user) {
          session.user.id = token.id as string
          session.user.tier = token.tier as "free" | "pro" | "enterprise"
          session.user.subscriptionStatus = token.subscriptionStatus as string | null
          session.user.approved = token.approved as boolean
        }
        return session
      } catch (error) {
        console.error('[Auth] Session callback error:', error)
        throw error
      }
    },
    async signIn({ user, account, profile }) {
      try {
        console.log('[Auth] SignIn callback triggered for:', user.email)

        if (!user.email) {
          console.log('[Auth] No email provided, denying sign in')
          return false
        }

        // Development bypass - allow specific email without approval
        const devBypassEmail = process.env.DEV_BYPASS_EMAIL
        if (devBypassEmail && user.email === devBypassEmail) {
          console.log(`[Auth] Dev bypass for ${user.email}`)

          // Ensure dev user exists and is approved in database
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          })

          if (existingUser && !existingUser.approved) {
            // Auto-approve dev user
            await prisma.user.update({
              where: { email: user.email },
              data: {
                approved: true,
                approvedAt: new Date(),
                approvedBy: 'dev-bypass'
              }
            })
            console.log(`[Auth] Auto-approved dev user: ${user.email}`)
          }

          return true // Allow access immediately
        }

        // Check if user is approved in database
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { approved: true, createdAt: true }
        })

        console.log('[Auth] DB user check:', { email: user.email, found: !!dbUser, approved: dbUser?.approved })

        if (!dbUser) {
          // New user signing up - they'll be created by Prisma adapter
          // Redirect to pending page
          console.log(`[Auth] New user signup: ${user.email}`)
          return '/auth/pending'
        }

        if (!dbUser.approved) {
          // Existing user but not approved yet
          console.log(`[Auth] Unapproved user attempted login: ${user.email}`)
          return '/auth/pending'
        }

        // User is approved - check if new user for onboarding
        const isNewUser = dbUser.createdAt > new Date(Date.now() - 5 * 60 * 1000) // Created in last 5 minutes

        if (isNewUser) {
          console.log(`[Auth] Redirecting new approved user to onboarding: ${user.email}`)
          return '/builder?new=true'
        }

        console.log(`[Auth] Redirecting approved user to builder: ${user.email}`)
        return '/builder'
      } catch (error) {
        console.error('[Auth] SignIn callback error:', error)
        throw error
      }
    },
  },
  debug: process.env.NODE_ENV === "development",
}