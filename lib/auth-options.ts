import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter } from "next-auth/adapters"
import { prisma } from "./prisma"
import { getUserSubscription } from "@/lib/stripe/stripe-utils"

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

// Validate environment variables in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  const missing = []
  if (!process.env.NEXTAUTH_SECRET) missing.push('NEXTAUTH_SECRET')
  if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID')
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET')
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')

  if (missing.length > 0) {
    console.error('[Auth] Missing required environment variables:', missing.join(', '))
  }
}

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
          // OAuth Flow Configuration:
          // - "select_account": Shows account chooser every time, but skips consent for returning users
          // - First-time users will still see consent screen (Google enforces this automatically)
          // - Returning users can quickly select their account without re-authorizing
          // - This follows industry best practices (Slack, Notion, etc.)
          prompt: "select_account",

          // Request offline access to get refresh tokens
          // This allows the app to access user data even when they're not actively using it
          access_type: "offline",

          // Standard OAuth 2.0 authorization code flow
          response_type: "code"
        }
      }
    }),
  ],
  session: {
    strategy: "jwt", // Use JWT for sessions (PrismaAdapter still manages users)
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/", // Direct to landing page for sign in
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      try {
        // Initial sign in - fetch user data from database
        if (account && user) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email! },
              select: { id: true, approved: true, tier: true }
            })

            // Fetch subscription data
            const subscription = await getUserSubscription(dbUser?.id || user.id)

            return {
              ...token,
              id: dbUser?.id || user.id,
              tier: dbUser?.tier || "free",
              approved: dbUser?.approved || false,
              subscription: subscription ? {
                status: subscription.status,
                tier: subscription.tier,
                currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              } : null,
              exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
            }
          } catch (dbError) {
            console.error('[Auth] Database error in JWT callback:', dbError)

            // Create a fallback token to prevent complete failure
            return {
              ...token,
              id: user.id,
              tier: "free" as const,
              approved: false, // Default to false for safety
              subscription: null,
              exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
            }
          }
        }

        return token
      } catch (error) {
        console.error('[Auth] Fatal error in JWT callback:', error)
        throw error
      }
    },
    async session({ session, token }) {
      try {
        if (session.user && token) {
          session.user.id = token.id as string
          session.user.tier = token.tier as "free" | "pro" | "enterprise"
          session.user.subscription = token.subscription as { status: string; tier: string; currentPeriodEnd: string } | null
          session.user.approved = token.approved as boolean
        }
        return session
      } catch (error) {
        console.error('[Auth] Error in session callback:', error)
        throw error
      }
    },
    async signIn({ user, account, profile }) {
      try {
        if (!user.email) {
          return false
        }

        // Development bypass - allow specific email without approval
        const devBypassEmail = process.env.DEV_BYPASS_EMAIL
        if (devBypassEmail && user.email === devBypassEmail) {
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
          }

          return true
        }

        // Check if user is approved in database
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { approved: true, createdAt: true }
        })

        // Allow sign-in for all users (new, unapproved, or approved)
        // Middleware will handle redirecting unapproved users to pending page
        return true
      } catch (error) {
        console.error('[Auth] Error in signIn callback:', error)
        return false
      }
    },
  },
  debug: process.env.NODE_ENV === "development",
}