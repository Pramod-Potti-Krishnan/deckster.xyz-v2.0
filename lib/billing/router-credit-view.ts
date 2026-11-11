/** Public credit projection. No credentials, router metadata or floating-point money. */
export const STUDIO_ROUTER_USAGE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ROUTER_USAGE === "true"

export type BillingPlan = "free" | "starter" | "pro" | "premium"
export interface RouterCreditBalance {
  available: true
  plan: BillingPlan
  period: { start: string; end: string }
  asOf: string
  credits: { planGranted: string; planUsed: string; planLeft: string; topUpLeft: string }
  images: { used: number; cap: number | null }
  daily?: { month: { start: string; end: string }; asOf: string; used: string; days: { day: string; used: string }[] }
}
export type RouterCreditView = RouterCreditBalance | { available: false }

const DECIMAL = /^\d{1,15}\.\d{6}$(?![\s\S])/
const PLANS = new Set(["free", "starter", "pro", "premium"])
export const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
export const fixedCredit = (v: unknown): v is string => typeof v === "string" && DECIMAL.test(v)
export const microcredits = (v: string): bigint => BigInt(v.replace(".", ""))

export function utcTimestamp(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$(?![\s\S])/.test(v)) return false
  const n = Date.parse(v)
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 19) === v.slice(0, 19)
}
const period = (v: unknown): v is { start: string; end: string } =>
  record(v) && utcTimestamp(v.start) && utcTimestamp(v.end) && Date.parse(v.start) < Date.parse(v.end)
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0

/** Browser validation also projects a fresh allowlist; extra upstream fields cannot reach the view. */
export function parsePublicCreditBalance(raw: unknown): RouterCreditBalance | null {
  if (!record(raw) || raw.available !== true || typeof raw.plan !== "string" || !PLANS.has(raw.plan) || !utcTimestamp(raw.asOf) || !period(raw.period)) return null
  const c = raw.credits, i = raw.images
  if (!record(c) || ![c.planGranted, c.planUsed, c.planLeft, c.topUpLeft].every(fixedCredit) || !record(i) || !count(i.used) || !(i.cap === null || count(i.cap))) return null
  const granted = c.planGranted as string, used = c.planUsed as string, left = c.planLeft as string
  if (microcredits(left) !== (microcredits(granted) > microcredits(used) ? microcredits(granted) - microcredits(used) : BigInt(0))) return null
  const view: RouterCreditBalance = {
    available: true, plan: raw.plan as BillingPlan, asOf: raw.asOf,
    period: { start: raw.period.start, end: raw.period.end },
    credits: { planGranted: granted, planUsed: used, planLeft: left, topUpLeft: c.topUpLeft as string },
    images: { used: i.used, cap: i.cap as number | null },
  }
  const chart = parseCreditDays(raw.daily)
  if (chart) view.daily = chart
  return view
}

export function parseCreditDays(raw: unknown): NonNullable<RouterCreditBalance["daily"]> | null {
  if (!record(raw) || !period(raw.month) || !utcTimestamp(raw.asOf) || !fixedCredit(raw.used) || !Array.isArray(raw.days) || raw.days.length > 31) return null
  const start = Date.parse(raw.month.start), end = Date.parse(raw.month.end), asOf = Date.parse(raw.asOf)
  const first = new Date(start)
  if (first.getUTCDate() !== 1 || first.getUTCHours() || first.getUTCMinutes() || first.getUTCSeconds() || first.getUTCMilliseconds() || start !== Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1) || end !== Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1) || asOf < start || asOf >= end) return null
  const days: { day: string; used: string }[] = []
  let sum = BigInt(0)
  for (const entry of raw.days) {
    if (!record(entry) || typeof entry.day !== "string" || !/^\d{4}-\d\d-\d\d$(?![\s\S])/.test(entry.day) || !fixedCredit(entry.used)) return null
    const at = Date.parse(`${entry.day}T00:00:00Z`)
    // Require the complete ascending series through asOf, including real zero days.
    if (at !== start + days.length * 86400000 || at > asOf || new Date(at).toISOString().slice(0, 10) !== entry.day) return null
    days.push({ day: entry.day, used: entry.used }); sum += microcredits(entry.used)
  }
  if (days.length !== Math.floor((asOf - start) / 86400000) + 1 || sum !== microcredits(raw.used)) return null
  return { month: { start: raw.month.start, end: raw.month.end }, asOf: raw.asOf, used: raw.used, days }
}

/** Decimal-safe whole credits. This display floor is never an admission decision. */
export function creditDisplay(fixedSix: string): string {
  if (!fixedCredit(fixedSix)) return "Unavailable"
  const amount = microcredits(fixedSix)
  if (amount > BigInt(0) && amount < BigInt(1000000)) return "under 1 credit"
  const whole = amount / BigInt(1000000)
  return `${whole.toLocaleString("en-US")} ${whole === BigInt(1) ? "credit" : "credits"}`
}

export const billingPlanLabel = (plan: BillingPlan): string => ({ free: "Free", starter: "Starter", pro: "Pro", premium: "Max" })[plan]
export const creditPercent = (used: string, granted: string): number | null => {
  const total = microcredits(granted)
  if (total === BigInt(0)) return null
  const percentage = microcredits(used) * BigInt(100) / total
  return Number(percentage > BigInt(100) ? BigInt(100) : percentage)
}
