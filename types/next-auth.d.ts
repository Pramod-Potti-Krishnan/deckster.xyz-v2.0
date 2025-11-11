import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    tier?: "free" | "pro" | "enterprise"
    subscriptionStatus?: string | null
    subscriptionId?: string | null
    subscriptionEndDate?: Date | null
    trialEndsAt?: Date | null
    approved?: boolean
  }

  interface Session {
    user: {
      id: string
      tier: "free" | "pro" | "enterprise"
      subscriptionStatus: string | null
      approved: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    tier: "free" | "pro" | "enterprise"
    subscriptionStatus: string | null
    approved: boolean
  }
}