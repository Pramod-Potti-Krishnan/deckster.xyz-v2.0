// STUDIO USAGE CREDITS (FRONTEND-2; B62). Flag NEXT_PUBLIC_STUDIO_USAGE_CREDITS (exact "true", default off, read at build time). Import-free and pure: the flag, the parser of the Model Router's usage read API answer
// (GET /v1/usage/user/{user_id}/credits; contract: streams/router/USAGE-READ-API.md, CODEX-8) and the words and numbers the credits view shows. No I/O and no environment other than the flag: the route
// (app/api/usage/credits/route.ts) reads the router address and the server-only key, the view (components/studio-usage-credits.tsx) draws what this file returns.
//
// CREDITS ONLY (FRONTEND-1's rule for the Usage page, 5 Nov): the view model holds the contract's credit fields and nothing else. A router answer that carried cost, USD, token, model or provider fields would lose them here: unknown fields are ignored, never copied.
// What the parser keeps, and what it refuses:
//   - every credit amount is a decimal string with exactly six places ("3.000000") and stays a STRING: no float ever touches an amount that is shown. The meter and the bars need ratios only, and those are
//     computed from the amounts as exact integers (millionths of a credit, BigInt); the display trims trailing zeros of the string itself;
//   - timestamps are ISO 8601 UTC ("...Z"), `daily` is at most 31 entries, strictly ascending, each a real calendar day (YYYY-MM-DD);
//   - a required field that is missing or malformed makes the WHOLE answer invalid: an error state, never zeros. Unknown fields are ignored. A real zero-usage month is a valid answer with zeroUsage true;
//   - the answer must be about the signed-in person: a `user_id` that is not the one asked for is invalid (the view never shows another person's numbers).

export const STUDIO_USAGE_CREDITS_FLAG = 'NEXT_PUBLIC_STUDIO_USAGE_CREDITS'

/** On only for the exact string "true"; every other value (unset, "false", "TRUE", " true", "1") is off. */
export function studioUsageCreditsOn(value: string | null | undefined): boolean {
  return value === 'true'
}

/** The flag, resolved once at build time. */
export const STUDIO_USAGE_CREDITS_ENABLED = studioUsageCreditsOn(process.env.NEXT_PUBLIC_STUDIO_USAGE_CREDITS)

/** The router's day buckets: at most 31 in a UTC month. */
export const USAGE_CREDITS_MAX_DAYS = 31

/** The codes /api/usage/credits answers with (the route's own, never the router's), and the view shows each in its own words. */
export const USAGE_CREDITS_ERROR_CODES = [
  'unauthorized', // no session
  'usage_read_unconfigured', // MODEL_ROUTER_URL or MODEL_ROUTER_USAGE_READ_KEY empty or unusable
  'usage_read_user_invalid', // the router refused the person's id (422 invalid_user_id), or Studio would not send it
  'usage_read_rate_limited', // 429, with Retry-After
  'usage_plans_unavailable', // 503 plans_unavailable
  'usage_credit_store_unavailable', // 503 credit_store_unavailable
  'usage_read_refused', // the router answered 401 or 403 to Studio's key
  'usage_read_network', // no answer: refused connection, DNS, TLS, timeout
  'usage_read_malformed', // an answer that is not JSON
  'usage_read_invalid', // JSON that is not the contract (a missing or malformed field, another person's id)
  'usage_read_unavailable', // any other router answer
  'usage_read_failed', // an unexpected failure inside Studio's route
] as const
export type UsageCreditsErrorCode = (typeof USAGE_CREDITS_ERROR_CODES)[number]

export interface UsageCreditsDay {
  /** YYYY-MM-DD, a UTC day. */
  date: string
  /** Decimal string, six places. */
  creditsUsed: string
}

/** What the browser gets on success: the router's answer, parsed and checked, in camel case. Amounts are decimal strings with six places. */
export interface UsageCreditsView {
  asOf: string
  month: { start: string; end: string }
  creditsUsed: string
  creditsLeft: string
  balancePeriod: { key: string; start: string; end: string }
  plan: string
  planSource: string
  planCreditsGranted: string
  planCreditsUsed: string
  planCreditsLeft: string
  topupCreditsLeft: string
  daily: UsageCreditsDay[]
  /** A real zero-usage month: the answer is valid and credits_used is zero. Not the same as unavailable. */
  zeroUsage: boolean
}

export type UsageCreditsParse = { ok: true; view: UsageCreditsView } | { ok: false; reason: string }

const DECIMAL = /^\d{1,15}\.\d{6}$/
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?Z$/
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const SHORT_TEXT = /^[\x21-\x7e][\x20-\x7e]{0,63}$/

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** A decimal string with exactly six places, no sign. */
export const isUsageDecimal = (value: unknown): value is string => typeof value === 'string' && DECIMAL.test(value)

/** Milliseconds since the epoch of an ISO 8601 UTC timestamp that names a real instant, else null. */
function timestampMs(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = TIMESTAMP.exec(value)
  if (!m) return null
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number)
  const at = new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d || at.getUTCHours() !== h || at.getUTCMinutes() !== mi || at.getUTCSeconds() !== s) return null
  return at.getTime()
}

/** Milliseconds of a real calendar day (YYYY-MM-DD) at 00:00 UTC, else null. */
function dayMs(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = DAY.exec(value)
  if (!m) return null
  const [y, mo, d] = [m[1], m[2], m[3]].map(Number)
  const at = new Date(Date.UTC(y, mo - 1, d))
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null
  return at.getTime()
}

/** Millionths of a credit, as an exact integer. */
const micro = (amount: string): bigint => BigInt(amount.replace('.', ''))

/** Is this a view the parser could have made? The browser runs it on the route's answer: a response that fails it is an error state, never zeros. */
export function isUsageCreditsView(value: unknown): value is UsageCreditsView {
  if (!isRecord(value)) return false
  const text = (v: unknown) => typeof v === 'string' && SHORT_TEXT.test(v)
  const period = (v: unknown, keyed: boolean) => isRecord(v) && (!keyed || text(v.key)) && timestampMs(v.start) !== null && timestampMs(v.end) !== null && (timestampMs(v.start) as number) < (timestampMs(v.end) as number)
  if (timestampMs(value.asOf) === null || !period(value.month, false) || !period(value.balancePeriod, true)) return false
  for (const key of ['creditsUsed', 'creditsLeft', 'planCreditsGranted', 'planCreditsUsed', 'planCreditsLeft', 'topupCreditsLeft'] as const) if (!isUsageDecimal(value[key])) return false
  if (!text(value.plan) || !text(value.planSource) || typeof value.zeroUsage !== 'boolean' || !Array.isArray(value.daily) || value.daily.length > USAGE_CREDITS_MAX_DAYS) return false
  let last = -Infinity
  for (const day of value.daily) {
    if (!isRecord(day) || !isUsageDecimal(day.creditsUsed)) return false
    const at = dayMs(day.date)
    if (at === null || at <= last) return false
    last = at
  }
  return value.zeroUsage === (micro(value.creditsUsed as string) === BigInt(0))
}

/**
 * The router's usage answer as a view. `expectUserId` is the signed-in person's id: an answer for any other id is invalid. Missing or malformed required fields are invalid, unknown fields are ignored.
 * `reason` names the first problem for a proof or a developer; it is never shown and never carries the router's text.
 */
export function parseUsageCredits(body: unknown, expectUserId?: string): UsageCreditsParse {
  const bad = (reason: string): UsageCreditsParse => ({ ok: false, reason })
  if (!isRecord(body)) return bad('not an object')
  if (typeof body.user_id !== 'string' || body.user_id === '') return bad('user_id')
  if (expectUserId !== undefined && body.user_id !== expectUserId) return bad('user_id is not the signed-in person')
  const month = body.month, period = body.balance_period
  if (!isRecord(month) || !isRecord(period)) return bad('month / balance_period')
  for (const key of ['credits_used', 'credits_left', 'plan_credits_granted', 'plan_credits_used', 'plan_credits_left', 'topup_credits_left'] as const) if (!isUsageDecimal(body[key])) return bad(key)
  if (!Array.isArray(body.daily)) return bad('daily')
  if (body.daily.length > USAGE_CREDITS_MAX_DAYS) return bad('daily has more than 31 days')
  const daily: UsageCreditsDay[] = []
  for (const entry of body.daily) {
    if (!isRecord(entry) || dayMs(entry.date) === null || !isUsageDecimal(entry.credits_used)) return bad('daily entry')
    daily.push({ date: entry.date as string, creditsUsed: entry.credits_used as string })
  }
  const view: UsageCreditsView = {
    asOf: body.as_of as string,
    month: { start: month.start as string, end: month.end as string },
    creditsUsed: body.credits_used as string,
    creditsLeft: body.credits_left as string,
    balancePeriod: { key: period.key as string, start: period.start as string, end: period.end as string },
    plan: body.plan as string,
    planSource: body.plan_source as string,
    planCreditsGranted: body.plan_credits_granted as string,
    planCreditsUsed: body.plan_credits_used as string,
    planCreditsLeft: body.plan_credits_left as string,
    topupCreditsLeft: body.topup_credits_left as string,
    daily,
    zeroUsage: micro(body.credits_used as string) === BigInt(0),
  }
  // The same checks the browser runs (timestamps, ascending days, short texts), so a view the parser makes always passes them and nothing else does.
  return isUsageCreditsView(view) ? { ok: true, view } : bad('a timestamp, a day order or a text field')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Nov 15": the UTC day of an ISO timestamp or a YYYY-MM-DD day, without the year (the chart's axis). Anything else comes back as it is. */
export function formatUsageDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}` : value
}

/** "Nov 15, 2026": the UTC date of an ISO timestamp or a YYYY-MM-DD day. Anything else comes back as it is (never throws). */
export function formatUsageDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return value
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`
}

/** A credit amount for people: the decimal string itself with the trailing zeros of its fraction dropped and the whole part grouped by thousands ("4502.500000" -> "4,502.5", "3.000000" -> "3"). No float: the digits are the router's. */
export function formatUsageCredits(amount: string): string {
  if (!isUsageDecimal(amount)) return amount
  const [whole, fraction] = amount.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return trimmed ? `${grouped}.${trimmed}` : grouped
}

/** Whole percent (0 to 100, rounded down) of `part` in `whole`, from the exact amounts; null when `whole` is zero. Capped at 100. */
export function usagePercent(part: string, whole: string): number | null {
  if (!isUsageDecimal(part) || !isUsageDecimal(whole)) return null
  const total = micro(whole)
  if (total === BigInt(0)) return null
  const share = (micro(part) * BigInt(100)) / total
  return share > BigInt(100) ? 100 : Number(share)
}

/** Bar heights, in tenths of a percent (0 to 1000) of the busiest day, from the exact amounts. All zero days: every bar is 0. */
export function usageBarHeights(daily: readonly UsageCreditsDay[]): number[] {
  const values = daily.map(day => micro(day.creditsUsed))
  const top = values.reduce((max, v) => (v > max ? v : max), BigInt(0))
  return values.map(v => (top === BigInt(0) ? 0 : Number((v * BigInt(1000)) / top)))
}

/** The busiest day's amount as a decimal string, or null with no day. */
export function usageBusiestDay(daily: readonly UsageCreditsDay[]): UsageCreditsDay | null {
  let best: UsageCreditsDay | null = null
  for (const day of daily) if (best === null || micro(day.creditsUsed) > micro(best.creditsUsed)) best = day
  return best
}

/** The plan's name for people: free, starter, pro, premium get their usual capital; any other plan id is shown as the router sent it. */
export function usagePlanLabel(plan: string): string {
  return /^(free|starter|pro|premium)$/.test(plan) ? plan[0].toUpperCase() + plan.slice(1) : plan
}

/** What the view shows: loading, a valid answer, or one of the route's own codes (with the seconds to wait when it said so). */
export type UsageCreditsState =
  | { kind: 'loading' }
  | { kind: 'ready'; view: UsageCreditsView }
  | { kind: 'error'; code: UsageCreditsErrorCode; retryAfterSeconds: number | null }

/**
 * The browser's reading of /api/usage/credits' JSON: { ok: true, view } with a view that passes isUsageCreditsView is ready; { ok: false, code } with one of the route's codes is that error; anything else
 * (not JSON, another shape, a view that is not one) is usage_read_invalid. Never zeros.
 */
export function usageCreditsStateOf(body: unknown): UsageCreditsState {
  if (isRecord(body) && body.ok === true && isUsageCreditsView(body.view)) return { kind: 'ready', view: body.view }
  if (isRecord(body) && body.ok === false && typeof body.code === 'string' && (USAGE_CREDITS_ERROR_CODES as readonly string[]).includes(body.code)) {
    const wait = body.retryAfterSeconds
    return { kind: 'error', code: body.code as UsageCreditsErrorCode, retryAfterSeconds: typeof wait === 'number' && Number.isInteger(wait) && wait >= 0 && wait <= 99999 ? wait : null }
  }
  return { kind: 'error', code: 'usage_read_invalid', retryAfterSeconds: null }
}

/** The view's state name (data-state): ok, zero, or the kind of unavailable. */
export function usageCreditsStateName(state: UsageCreditsState): string {
  if (state.kind === 'loading') return 'loading'
  if (state.kind === 'ready') return state.view.zeroUsage ? 'zero' : 'ok'
  switch (state.code) {
    case 'unauthorized': return 'signed-out'
    case 'usage_read_unconfigured': return 'unconfigured'
    case 'usage_read_rate_limited': return 'rate-limited'
    case 'usage_plans_unavailable': return 'plans-unavailable'
    case 'usage_credit_store_unavailable': return 'credit-store-unavailable'
    case 'usage_read_invalid': case 'usage_read_malformed': return 'invalid'
    default: return 'unavailable'
  }
}
