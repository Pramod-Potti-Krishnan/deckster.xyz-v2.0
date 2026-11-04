// FRONTEND-1 (L-BILLING F5 = S-3 quota and refusal UX, plus a Usage page; 4 Nov). Flag NEXT_PUBLIC_STUDIO_USAGE_PAGE (the string "true", default off, build-time).
// Pure: the flag, the credits view and the refusal words. Credits only: 1 credit = $0.01 of billed value (L-BILLING §0), so a cents figure from
// /api/usage/quota or the wallet IS a credit count. Never shows tokens, provider cost, margin or model ids. Prices are read from PRICING_TIERS only.
import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"

export const STUDIO_USAGE_PAGE_FLAG = "NEXT_PUBLIC_STUDIO_USAGE_PAGE"

/** On only for the exact string "true". */
export function isStudioUsagePageOn(value: unknown = process.env.NEXT_PUBLIC_STUDIO_USAGE_PAGE): boolean {
  return value === "true"
}

/** Whole credits for display; a positive amount under 1 credit reads "under 1" (spec F5 "under 1 credit" rule). */
export function formatCredits(cents: unknown): string {
  const n = typeof cents === "number" && Number.isFinite(cents) ? Math.max(0, cents) : 0
  if (n > 0 && n < 1) return "under 1"
  return Math.floor(n).toLocaleString("en-US")
}

export interface UsageQuotaInput {
  tier?: string
  tierLabel?: string
  caps?: { monthlyCents?: number }
  spent?: { monthlyCents?: number }
}

export interface UsageView {
  planLabel: string
  planCredits: number
  usedCredits: number
  leftCredits: number
  topUpCredits: number
  usedFraction: number
  state: "ok" | "low" | "exhausted"
}

/** The Usage page's numbers: plan credits used and left this period, plus the top-up balance (the wallet). Nothing else is read. */
export function usageView(quota: UsageQuotaInput | null | undefined, walletBalanceCents: unknown): UsageView {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0)
  const planCredits = num(quota?.caps?.monthlyCents)
  const usedCredits = Math.min(num(quota?.spent?.monthlyCents), planCredits || Infinity)
  const leftCredits = Math.max(0, planCredits - usedCredits)
  const topUpCredits = num(walletBalanceCents)
  const usedFraction = planCredits > 0 ? Math.min(1, usedCredits / planCredits) : 1
  const total = leftCredits + topUpCredits
  const state = total < 1 ? "exhausted" : planCredits > 0 && leftCredits / planCredits < 0.2 ? "low" : "ok"
  return { planLabel: quota?.tierLabel || "Free", planCredits, usedCredits, leftCredits, topUpCredits, usedFraction, state }
}

export type RefusalKind = "credits_exhausted" | "image_cap_reached" | "plan_required" | "cap_reached" | "wallet_capped"

export interface RefusalCopy {
  title: string
  body: string
  primary: { label: string; href: string }
  secondary?: { label: string; href: string }
}

/** The cheapest plan above the current tier, from PRICING_TIERS (name + price only). */
export function nextPlanUp(tier: unknown): { name: string; price: string } | null {
  const order = ["free", "starter", "pro", "premium"]
  const at = order.indexOf(typeof tier === "string" ? tier : "free")
  for (const id of order.slice(Math.max(0, at) + 1)) {
    const plan = PRICING_TIERS.find(t => t.id === id)
    if (plan) return { name: plan.name, price: plan.price }
  }
  return null
}

/** Map a refusal code (router 402/403 or Director QUOTA_EXCEEDED / PLAN_REQUIRED) to a kind. Unknown codes are null: not a billing refusal. */
export function refusalKind(code: unknown): RefusalKind | null {
  switch (code) {
    case "credits_exhausted": case "QUOTA_EXCEEDED": return "credits_exhausted"
    case "image_cap_reached": return "image_cap_reached"
    case "model_not_in_plan": case "feature_not_in_plan": case "PLAN_REQUIRED": return "plan_required"
    case "daily_cap_reached": case "weekly_cap_reached": return "cap_reached"
    case "wallet_capped": return "wallet_capped"
    default: return null
  }
}

/** Plain words and one clear next step. No cost, tokens or model names. */
export function refusalCopy(kind: RefusalKind, tier?: unknown): RefusalCopy {
  const up = nextPlanUp(tier)
  const upgrade = up ? { label: `Upgrade to ${up.name} (${up.price}/month)`, href: "/billing" } : null
  const topUp = { label: "Top up credits", href: "/billing#top-up" }
  switch (kind) {
    case "credits_exhausted":
      return { title: "You're out of credits", body: "You've used all the credits on your plan this period. Top up to keep going now, or upgrade for more credits every month. A build already running will finish.", primary: topUp, ...(upgrade ? { secondary: upgrade } : {}) }
    case "image_cap_reached":
      return { title: "You've reached your image limit", body: "Your plan's images for this period are used up. Upgrade for a higher image limit. Text and charts still work.", primary: upgrade ?? topUp }
    case "plan_required":
      return { title: "This needs a higher plan", body: "This feature isn't included in your current plan. Upgrade to use it.", primary: upgrade ?? { label: "See plans", href: "/billing" } }
    case "wallet_capped":
      return { title: "Not enough credits to start", body: "You don't have enough credits left to start this. Top up to keep going now, or upgrade for more credits every month.", primary: topUp, ...(upgrade ? { secondary: upgrade } : {}) }
    case "cap_reached":
      return { title: "You've hit today's limit", body: "You've reached your plan's limit for now. It resets soon, or you can top up to keep going.", primary: topUp, ...(upgrade ? { secondary: upgrade } : {}) }
  }
}

/** The window event the Builder's refusal overlay listens for. */
export const QUOTA_REFUSAL_EVENT = "studio-quota-refusal"

/** Flag on and a billing refusal code: tell the Builder (a window event; nothing else). Returns whether it announced. */
export function announceQuotaRefusal(code: unknown): boolean {
  if (!isStudioUsagePageOn() || !refusalKind(code) || typeof window === "undefined") return false
  window.dispatchEvent(new CustomEvent(QUOTA_REFUSAL_EVENT, { detail: { code } }))
  return true
}

/** Pure: a precheck response status/body is allowed unless it is a billing refusal. 404 (F4 not deployed) and any other failure count as allowed. */
export function precheckAllows(status: number, body: unknown): { ok: boolean; code?: string } {
  if (status === 402 || status === 403) {
    const code = body && typeof body === "object" ? (body as { code?: unknown }).code : undefined
    if (typeof code === "string" && refusalKind(code)) return { ok: false, code }
  }
  return { ok: true }
}

/** Before a send: POST /api/wallet/precheck. Off: true without a call. A 404 or network failure is allowed. A refusal is announced and returns false. */
export async function walletPrecheckAllows(fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!isStudioUsagePageOn()) return true
  try {
    const res = await fetcher("/api/wallet/precheck", { method: "POST" })
    const body = res.status === 402 || res.status === 403 ? await res.json().catch(() => null) : null
    const verdict = precheckAllows(res.status, body)
    if (!verdict.ok) announceQuotaRefusal(verdict.code)
    return verdict.ok
  } catch {
    return true
  }
}
