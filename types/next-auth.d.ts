import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    tier?: "free" | "pro" | "enterprise"
    subscription?: {
      status: string
      tier: string
      currentPeriodEnd: string
    } | null
    approved?: boolean
  }

  interface Session {
    user: {
      id: string
      tier: "free" | "pro" | "enterprise"
      subscription: {
        status: string
        tier: string
        currentPeriodEnd: string
      } | null
      approved: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    tier: "free" | "pro" | "enterprise"
    subscription: {
      status: string
      tier: string
      currentPeriodEnd: string
    } | null
    approved: boolean
  }
}