import { prisma } from "@/lib/prisma"
import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"
import {
  startOfDayEastUtc,
  startOfWeekEastUtc,
  startOfMonthEastUtc,
  nextDayResetEastUtc,
  nextWeekResetEastUtc,
} from "@/lib/quota/est-time"

export type Tier = "free" | "starter" | "pro" | "premium"

/** Fraction of a cap that counts as "near the limit" (amber warning). */
export const NEAR_THRESHOLD = 0.8

function priceToCents(price: string): number {
  const n = parseFloat(price.replace(/[^0-9.]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function findTierPriceCents(id: "starter" | "pro" | "premium"): number {
  const tier = PRICING_TIERS.find((t) => t.id === id)
  return tier ? priceToCents(tier.price) : 0
}

/**
 * Monthly $ cap per tier = the plan price (single-sourced from marketing
 * pricing). Use-it-or-lose-it: this is a per-period limit, never a balance.
 */
export const TIER_MONTHLY_CAP_CENTS: Record<Tier, number> = {
  free: 0,
  starter: findTierPriceCents("starter"), // $20 -> 2000
  pro: findTierPriceCents("pro"), // $50 -> 5000
  premium: findTierPriceCents("premium"), // $100 -> 10000
}

export const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  premium: "Max",
}

export interface QuotaCaps {
  monthlyCents: number
  weeklyCents: number
  dailyCents: number
}

/** Weekly = monthly / 4, daily = weekly / 2 (= monthly / 8). */
export function getQuotaCaps(tier: Tier): QuotaCaps {
  const monthlyCents = TIER_MONTHLY_CAP_CENTS[tier] ?? 0
  const weeklyCents = Math.round(monthlyCents / 4)
  const dailyCents = Math.round(weeklyCents / 2)
  return { monthlyCents, weeklyCents, dailyCents }
}

export interface QuotaStatus {
  tier: Tier
  tierLabel: string
  caps: QuotaCaps
  spent: { dailyCents: number; weeklyCents: number; monthlyCents: number }
  /** Fraction of the cap still available (0..1). */
  remainingPct: { daily: number; weekly: number; monthly: number }
  flags: {
    dailyNear: boolean
    dailyAt: boolean
    weeklyNear: boolean
    weeklyAt: boolean
  }
  /** Persistent prepaid reserve used for overflow once a cap is hit. */
  walletBalanceCents: number
  resetAt: { daily: string; weekly: string }
  /** Background tracking — not necessarily surfaced in the UI. */
  totals: {
    monthTokens: number
    monthSpendCents: number
    lifetimeTokens: number
    lifetimeSpendCents: number
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/** Remaining fraction of a cap. A zero cap is treated as fully exhausted. */
function remaining(spentCents: number, capCents: number): number {
  if (capCents <= 0) return 0
  return clamp01(1 - spentCents / capCents)
}

/**
 * Compute the live quota picture for a user by summing `token_usage` ledger
 * rows within the Eastern day / week / month windows. No separate counter
 * table — the window slides automatically as time passes.
 */
export async function getQuotaStatus(userId: string, tier: Tier): Promise<QuotaStatus> {
  const now = new Date()
  const dayStart = startOfDayEastUtc(now)
  const weekStart = startOfWeekEastUtc(now)
  const monthStart = startOfMonthEastUtc(now)

  const sumUsage = (gte?: Date) =>
    prisma.walletTransaction.aggregate({
      where: { userId, reason: "token_usage", ...(gte ? { createdAt: { gte } } : {}) },
      _sum: { amountCents: true, tokens: true },
    })

  const [user, daySum, weekSum, monthSum, lifeSum] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { walletBalanceCents: true } }),
    sumUsage(dayStart),
    sumUsage(weekStart),
    sumUsage(monthStart),
    sumUsage(),
  ])

  const caps = getQuotaCaps(tier)
  const dailyCents = daySum._sum.amountCents ?? 0
  const weeklyCents = weekSum._sum.amountCents ?? 0
  const monthlyCents = monthSum._sum.amountCents ?? 0

  const dailyAt = caps.dailyCents > 0 ? dailyCents >= caps.dailyCents : true
  const weeklyAt = caps.weeklyCents > 0 ? weeklyCents >= caps.weeklyCents : true
  const dailyNear =
    !dailyAt && caps.dailyCents > 0 && dailyCents >= caps.dailyCents * NEAR_THRESHOLD
  const weeklyNear =
    !weeklyAt && caps.weeklyCents > 0 && weeklyCents >= caps.weeklyCents * NEAR_THRESHOLD

  return {
    tier,
    tierLabel: TIER_LABELS[tier] ?? "Free",
    caps,
    spent: { dailyCents, weeklyCents, monthlyCents },
    remainingPct: {
      daily: remaining(dailyCents, caps.dailyCents),
      weekly: remaining(weeklyCents, caps.weeklyCents),
      monthly: remaining(monthlyCents, caps.monthlyCents),
    },
    flags: { dailyNear, dailyAt, weeklyNear, weeklyAt },
    walletBalanceCents: user?.walletBalanceCents ?? 0,
    resetAt: {
      daily: nextDayResetEastUtc(now).toISOString(),
      weekly: nextWeekResetEastUtc(now).toISOString(),
    },
    totals: {
      monthTokens: monthSum._sum.tokens ?? 0,
      monthSpendCents: monthlyCents,
      lifetimeTokens: lifeSum._sum.tokens ?? 0,
      lifetimeSpendCents: lifeSum._sum.amountCents ?? 0,
    },
  }
}

/**
 * Would charging `costCents` now keep the user within ALL plan caps?
 * Used by the debit route to decide plan-included vs overflow.
 */
export function fitsWithinCaps(
  caps: QuotaCaps,
  spent: { dailyCents: number; weeklyCents: number; monthlyCents: number },
  costCents: number,
): boolean {
  if (caps.monthlyCents <= 0) return false
  return (
    spent.dailyCents + costCents <= caps.dailyCents &&
    spent.weeklyCents + costCents <= caps.weeklyCents &&
    spent.monthlyCents + costCents <= caps.monthlyCents
  )
}
