import "server-only"
import { parseCreditDays, parsePublicCreditBalance, record, type RouterCreditBalance, type RouterCreditView } from "./router-credit-view"

export const routerCreditsReadEnabled = (): boolean => process.env.STUDIO_ROUTER_CREDITS_READ === "true"
const USER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$(?![\s\S])/
const MAX_BYTES = 64 * 1024
const DEADLINE_MS = 4000
interface CreditReadDeps {
  fetcher?: typeof fetch
  env?: { MODEL_ROUTER_URL?: string; ROUTER_CREDITS_READ_API_KEY?: string }
}

/** Bind a router response to the authenticated opaque account and discard all internal fields. */
export function parseRouterCreditView(raw: unknown, userId: string): RouterCreditBalance | null {
  if (!record(raw) || raw.user_id !== userId || !record(raw.credits) || !record(raw.images)) return null
  if (raw.plan_source === "failsafe" || raw.plan_source === "invalid_id") return null
  return parsePublicCreditBalance({
    available: true, plan: raw.plan, asOf: raw.as_of, period: raw.period,
    credits: { planGranted: raw.credits.plan_granted, planUsed: raw.credits.plan_used, planLeft: raw.credits.plan_left, topUpLeft: raw.credits.topup_balance },
    images: { used: raw.images.used, cap: raw.images.cap },
  })
}

function routerBase(raw: string | undefined): string | null {
  try {
    const url = new URL(raw ?? "")
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "").replace(/\/v1$/, "")
  } catch { return null }
}

/** Bound streamed bytes before parsing, including responses without a Content-Length header. */
async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) { await response.body?.cancel(); return null }
  if (!response.body) return null
  const length = response.headers.get("content-length")
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) { await response.body.cancel(); return null }
  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let bytes = 0, text = ""
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > MAX_BYTES) { await reader.cancel(); return null }
      text += decoder.decode(next.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } finally { reader.releaseLock() }
}

/** Server read only; the caller supplies session.user.id, never a request parameter. No writes or logs. */
export async function getRouterCreditsForSession(userId: string, deps: CreditReadDeps = {}): Promise<RouterCreditView> {
  if (!routerCreditsReadEnabled()) return { available: false }
  const env = deps.env ?? process.env
  const base = routerBase(env.MODEL_ROUTER_URL), key = env.ROUTER_CREDITS_READ_API_KEY
  if (!USER_ID.test(userId) || !base || !key || !/^[\x21-\x7e]{8,512}$(?![\s\S])/.test(key)) return { available: false }
  const fetcher = deps.fetcher ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEADLINE_MS)
  const read = async (path: string): Promise<unknown> => {
    try {
      const response = await fetcher(`${base}${path}`, { method: "GET", headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: controller.signal })
      return await readJson(response)
    } catch { return null }
  }
  try {
    const raw = await read(`/v1/credits/${encodeURIComponent(userId)}`)
    const view = parseRouterCreditView(raw, userId)
    if (!view) return { available: false }
    // The chart is an optional, independently stamped UTC-month read. Its balance is never used.
    const month = await read(`/v1/usage/user/${encodeURIComponent(userId)}/credits`)
    if (record(month) && month.user_id === userId && Array.isArray(month.daily)) {
      const chart = parseCreditDays({ month: month.month, asOf: month.as_of, used: month.credits_used, days: month.daily.map(day => record(day) ? { day: day.date, used: day.credits_used } : null) })
      if (chart) view.daily = chart
    }
    return view
  } finally { clearTimeout(timeout) }
}
