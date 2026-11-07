import { prisma } from "@/lib/prisma"
import type { Tier } from "@/lib/quota/quota"

const TIERS: readonly string[] = ["free", "starter", "pro", "premium"]

/** The user's tier from the Prisma User row (written by Stripe webhook / coupon redeem). */
export async function getServerTier(userId: string): Promise<Tier> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } })
  const tier = row?.tier
  return (typeof tier === "string" && TIERS.includes(tier) ? tier : "free") as Tier
}
