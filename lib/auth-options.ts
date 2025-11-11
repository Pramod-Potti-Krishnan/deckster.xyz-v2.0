import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter } from "next-auth/adapters"
import { prisma } from "./prisma"

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

export const authOptions: NextAuthOptions = {
  // Use Prisma adapter for database storage
  adapter: PrismaAdapter(prisma) as Adapter,
  // Trust host in production (required for Vercel)
  trustHost: true,
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
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  pages: {
    signIn: "/", // Direct to landing page for sign in
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (account && user) {
        // Fetch user from database to get approval status
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, approved: true, tier: true }
        })

        return {
          ...token,
          id: dbUser?.id || user.id,
          tier: dbUser?.tier || "free",
          approved: dbUser?.approved || false,
          subscriptionStatus: null,
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.tier = token.tier as "free" | "pro" | "enterprise"
        session.user.subscriptionStatus = token.subscriptionStatus as string | null
        session.user.approved = token.approved as boolean
      }
      return session
    },
    async signIn({ user, account, profile }) {
      if (!user.email) {
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
        }

        return true // Allow access immediately
      }

      // Check if user is approved in database
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { approved: true, createdAt: true }
      })

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
        return '/builder?new=true'
      }

      return '/builder'
    },
  },
  debug: process.env.NODE_ENV === "development",
}