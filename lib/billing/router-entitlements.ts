// BILLING-L5 (FRONTEND-2, B67; L-BILLING F3 = S-1, the Studio half): push a person's plan to the Model Router's entitlements store. SERVER-ONLY: it reads a server-only key and the database,
// so no client component, no "use client" file and nothing NEXT_PUBLIC_ imports it (the proof greps for that).
// Flag STUDIO_ROUTER_ENTITLEMENTS_PUSH (server, runtime, exact "true", default off). Off, every push function returns { skipped: true, reason: "flag_off" } BEFORE it reads any other environment value,
// the database or the network, and logs nothing: the callers behave exactly as today.
//
// The router contract (model-router TIER4-entitlements.md, MR-3 design doc A3/A4/A6, D3/D4/D5/D7/D13; ROUTER-2 to confirm before the flag goes on):
//   PUT {router}/v1/entitlements/{user_id}, Authorization: Bearer <key with ONLY the `entitlements` scope>, JSON body, strict (extra keys refused):
//     { plan: free|starter|pro|premium, status: <the Stripe status as stored>, period_start, period_end (ISO with Z; required for paid plans, left out for Free: the router uses the UTC calendar month, D7),
//       source: a label (stripe, signup, cancel, nightly, backfill), source_version: integer ms, strictly increasing per user }
//   plan_credits is LEFT OUT (D3 / P5: the registry's monthly_credits is the source; a mismatching value is a 422).
//   Answers: 200 {applied:true, stored_version} | 200 {applied:false, reason: stale|replay, stored_version} (out-of-order is normal: never retried) | 409 version_conflict | 413 | 422 (invalid_user_id,
//   invalid_entitlement, invalid_period, period_too_long, plan_credits_mismatch, future_version) | 503 entitlement_store_unavailable.
// source_version = Subscription.updatedAt in ms (D13); a person with no subscription row is Free at User.updatedAt in ms. A period over 32 days (yearly) is not pushed (P3 monthly only; the router would refuse it).
// The router's own reading of each status (A6, shadow only): active / trialing keep the plan; past_due keeps it until 72 h after the period; canceled, unpaid, incomplete, incomplete_expired are Free at once.
//
// The base address comes from the repo's no-fallback helper (requireServiceUrl, lib/service-url.ts) over the router address the narration and usage-credits code already use: no default, no production host.
// The key's NAME is ROUTER_ENTITLEMENTS_API_KEY (server-only; minted by OPS-2 with the `entitlements` scope only). It goes only into the Authorization header: never into a result, a log or an error.
// A push never throws and never fails its caller: it returns a typed outcome; the nightly re-push and the reconcile repair a missed one. Logs carry the user id and an outcome word only.
import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { prisma } from '@/lib/prisma'

export const ROUTER_ENTITLEMENTS_PUSH_FLAG = 'STUDIO_ROUTER_ENTITLEMENTS_PUSH'
export const ROUTER_ENTITLEMENTS_KEY_NAME = 'ROUTER_ENTITLEMENTS_API_KEY'

/** On only for the exact string "true". */
export function routerEntitlementsPushOn(value: string | null | undefined): boolean {
  return value === 'true'
}

export type RouterPlan = 'free' | 'starter' | 'pro' | 'premium'

/** The 7 Stripe statuses Studio stores (prisma/schema.prisma, Subscription.status). */
export const STRIPE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired'] as const
export type StripeSubscriptionStatus = (typeof STRIPE_SUBSCRIPTION_STATUSES)[number]
/** Stripe's eighth status: Studio's schema does not list it, but the webhook stores whatever Stripe sends, and the router accepts it and reads it as Free (review NB3). Pushed as it is. */
export const ROUTER_EXTRA_STATUSES = ['paused'] as const
export type PushedStatus = StripeSubscriptionStatus | (typeof ROUTER_EXTRA_STATUSES)[number]

/** What the router makes of each status (its A6 table). Documentation and proof only: the push sends the status exactly as Studio stores it. */
export const ROUTER_EFFECT_OF_STATUS: Readonly<Record<PushedStatus, 'plan' | 'plan_until_grace' | 'free'>> = {
  active: 'plan',
  trialing: 'plan',
  past_due: 'plan_until_grace',
  canceled: 'free',
  unpaid: 'free',
  incomplete: 'free',
  incomplete_expired: 'free',
  paused: 'free',
}

export type EntitlementSource = 'stripe' | 'signup' | 'cancel' | 'nightly' | 'backfill'

/** The PUT body, in the router's field names. */
export interface RouterEntitlementBody {
  plan: RouterPlan
  status: PushedStatus
  period_start?: string
  period_end?: string
  source: EntitlementSource
  source_version: number
}

export interface EntitlementUser {
  id: string
  tier?: string | null
  updatedAt: Date | string
}

export interface EntitlementSubscription {
  status: string
  tier: string
  currentPeriodStart: Date | string
  currentPeriodEnd: Date | string
  updatedAt: Date | string
}

export type EntitlementBuildFailure =
  | 'invalid_user_id'
  | 'unknown_status'
  | 'unknown_plan'
  | 'tier_without_subscription'
  | 'invalid_period'
  | 'period_too_long'
  | 'invalid_version'

export type BuiltEntitlement = { ok: true; userId: string; body: RouterEntitlementBody } | { ok: false; reason: EntitlementBuildFailure }

export type PushSkipReason = 'flag_off' | EntitlementBuildFailure | 'unknown_user' | 'not_an_entitlement_event' | 'no_subscription' | 'unknown_subscription'
export type PushError = 'unconfigured' | 'network' | 'timeout' | 'unauthorized' | 'version_conflict' | 'refused' | 'too_large' | 'unavailable' | 'malformed' | 'unexpected' | 'failed'

export type PushOutcome =
  | { skipped: true; reason: PushSkipReason }
  | { skipped: false; ok: true; applied: boolean; reason: 'stale' | 'replay' | null; storedVersion: number | null }
  | { skipped: false; ok: false; error: PushError; status: number | null; code: string | null }

/** The router's user id format (MR-3 A3). */
export const ROUTER_USER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/
const DAY_MS = 86_400_000
/** The router refuses a period longer than this (D4). */
export const MAX_PERIOD_MS = 32 * DAY_MS
const MIN_DATE_MS = Date.UTC(2000, 0, 1)
const MAX_DATE_MS = Date.UTC(2100, 0, 1)
/** Give up on the router after this long: a push must never hold a webhook or a sign-in up. */
export const PUSH_TIMEOUT_MS = 5000
/** The router's route cap is 4096 bytes. */
const MAX_PUSH_BYTES = 4096
const MAX_ANSWER_CHARS = 65536
const KEY_SHAPE = /^[\x21-\x7e]{8,512}$/

const PLAN_OF_TIER: Readonly<Record<string, RouterPlan>> = { starter: 'starter', pro: 'pro', premium: 'premium', max: 'premium' }

function ms(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const at = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isSafeInteger(at) && at >= MIN_DATE_MS && at < MAX_DATE_MS ? at : null
}

const PUSHED_STATUSES: readonly string[] = [...STRIPE_SUBSCRIPTION_STATUSES, ...ROUTER_EXTRA_STATUSES]
const isStatus = (value: unknown): value is PushedStatus => typeof value === 'string' && PUSHED_STATUSES.includes(value)

/**
 * The entitlement for one person: pure, no environment, no I/O. `subscription` is their newest Subscription row, or null when they have none.
 * No subscription and a Free account: Free (no period; the router uses the UTC calendar month) at User.updatedAt in ms. No subscription but a paid account tier (a coupon's tier): not pushed.
 * A subscription: its plan (Max is "premium"), its status as stored, its current period, and Subscription.updatedAt in ms.
 */
export function buildEntitlement(user: EntitlementUser, subscription: EntitlementSubscription | null, source: EntitlementSource = 'stripe'): BuiltEntitlement {
  if (typeof user?.id !== 'string' || !ROUTER_USER_ID.test(user.id)) return { ok: false, reason: 'invalid_user_id' }
  if (!subscription) {
    if (user.tier !== undefined && user.tier !== null && user.tier !== 'free') return { ok: false, reason: 'tier_without_subscription' }
    const version = ms(user.updatedAt)
    if (version === null) return { ok: false, reason: 'invalid_version' }
    return { ok: true, userId: user.id, body: { plan: 'free', status: 'active', source, source_version: version } }
  }
  if (!isStatus(subscription.status)) return { ok: false, reason: 'unknown_status' }
  const plan = Object.prototype.hasOwnProperty.call(PLAN_OF_TIER, subscription.tier) ? PLAN_OF_TIER[subscription.tier] : null
  if (!plan) return { ok: false, reason: 'unknown_plan' }
  const start = ms(subscription.currentPeriodStart), end = ms(subscription.currentPeriodEnd)
  if (start === null || end === null || start >= end) return { ok: false, reason: 'invalid_period' }
  if (end - start > MAX_PERIOD_MS) return { ok: false, reason: 'period_too_long' }
  const version = ms(subscription.updatedAt)
  if (version === null) return { ok: false, reason: 'invalid_version' }
  return {
    ok: true,
    userId: user.id,
    body: { plan, status: subscription.status, period_start: new Date(start).toISOString(), period_end: new Date(end).toISOString(), source, source_version: version },
  }
}

const fail = (error: PushError, status: number | null = null, code: string | null = null): PushOutcome => ({ skipped: false, ok: false, error, status, code })

/** The router's `error.code`, or null: only a short plain code is read, nothing else of its body. */
function routerErrorCode(text: string): string | null {
  try {
    const body: unknown = JSON.parse(text)
    const error = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : null
    const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null
    return typeof code === 'string' && /^[a-z_]{1,48}$/.test(code) ? code : null
  } catch {
    return null
  }
}

/** PUT one entitlement. Flag off: { skipped: true } before any other environment value is read. Never throws. */
export async function pushEntitlement(built: BuiltEntitlement): Promise<PushOutcome> {
  if (!routerEntitlementsPushOn(process.env.STUDIO_ROUTER_ENTITLEMENTS_PUSH)) return { skipped: true, reason: 'flag_off' }
  if (!built || built.ok !== true) return { skipped: true, reason: built?.reason ?? 'invalid_user_id' }
  try {
    let base: string
    try {
      base = requireServiceUrl('Model Router', [{ name: 'MODEL_ROUTER_URL', value: process.env.MODEL_ROUTER_URL }], { stripTrailingSlash: true }).replace(/\/v1$/, '')
    } catch (error) {
      if (error instanceof ServiceUrlConfigError) return fail('unconfigured')
      throw error
    }
    const key = (process.env.ROUTER_ENTITLEMENTS_API_KEY ?? '').trim()
    if (!KEY_SHAPE.test(key)) return fail('unconfigured')
    const body = JSON.stringify(built.body)
    if (body.length > MAX_PUSH_BYTES) return fail('too_large')

    let res: Response, text: string
    try {
      res = await fetch(`${base}/v1/entitlements/${encodeURIComponent(built.userId)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      })
      text = await res.text()
    } catch (error) {
      const name = (error as { name?: unknown } | null)?.name
      return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network')
    }
    if (text.length > MAX_ANSWER_CHARS) return fail('malformed', res.status)

    if (res.status === 200) {
      let answer: unknown
      try { answer = JSON.parse(text) } catch { return fail('malformed', 200) }
      const record = typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>) : null
      const stored = record && Number.isSafeInteger(record.stored_version) ? (record.stored_version as number) : null
      if (record?.applied === true) return { skipped: false, ok: true, applied: true, reason: null, storedVersion: stored }
      if (record?.applied === false && (record.reason === 'stale' || record.reason === 'replay')) return { skipped: false, ok: true, applied: false, reason: record.reason, storedVersion: stored }
      return fail('malformed', 200)
    }
    const code = routerErrorCode(text)
    if (res.status === 401 || res.status === 403) return fail('unauthorized', res.status, code)
    if (res.status === 409) return fail('version_conflict', 409, code)
    if (res.status === 413) return fail('too_large', 413, code)
    if (res.status === 422) return fail('refused', 422, code)
    if (res.status === 503) return fail('unavailable', 503, code)
    return fail('unexpected', res.status, code)
  } catch {
    return fail('failed')
  }
}

/** One log line: the user id (only when it is a valid router id), the source and an outcome word. Never a key, a body or an amount. */
export function entitlementPushLogLine(userId: string, source: EntitlementSource, outcome: PushOutcome): string {
  const who = typeof userId === 'string' && ROUTER_USER_ID.test(userId) ? userId : 'invalid'
  const word = outcome.skipped ? `skipped:${outcome.reason}` : outcome.ok ? (outcome.applied ? 'applied' : `not_applied:${outcome.reason}`) : `error:${outcome.error}${outcome.status === null ? '' : `:${outcome.status}`}`
  return `[router-entitlements] user=${who} source=${source} outcome=${word}`
}

/** Read one person and their newest subscription, build, push, log one line. Flag off: skipped before the database is read, and nothing is logged. Never throws. */
export async function pushEntitlementForUser(userId: string, source: EntitlementSource): Promise<PushOutcome> {
  if (!routerEntitlementsPushOn(process.env.STUDIO_ROUTER_ENTITLEMENTS_PUSH)) return { skipped: true, reason: 'flag_off' }
  let outcome: PushOutcome
  try {
    const user = typeof userId === 'string' && ROUTER_USER_ID.test(userId)
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, tier: true, updatedAt: true } })
      : null
    if (!user) {
      outcome = { skipped: true, reason: typeof userId === 'string' && ROUTER_USER_ID.test(userId) ? 'unknown_user' : 'invalid_user_id' }
    } else {
      const subscription = await prisma.subscription.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        select: { status: true, tier: true, currentPeriodStart: true, currentPeriodEnd: true, updatedAt: true },
      })
      outcome = await pushEntitlement(buildEntitlement(user, subscription, source))
    }
  } catch {
    outcome = fail('failed')
  }
  console.log(entitlementPushLogLine(userId, source, outcome))
  return outcome
}

/** The Stripe events that change a plan, and where each carries the subscription id. */
export const ENTITLEMENT_STRIPE_EVENTS: readonly string[] = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'checkout.session.completed',
]

function idOf(value: unknown): string | null {
  const id = typeof value === 'string' ? value : typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : null
  return typeof id === 'string' && /^sub_[A-Za-z0-9]{1,255}$/.test(id) ? id : null
}

/** The Stripe subscription id an event is about, or null (a top-up checkout, another event). */
export function stripeSubscriptionIdOf(event: { type?: unknown; data?: { object?: unknown } }): string | null {
  const object = event?.data?.object as Record<string, unknown> | undefined
  if (!object || typeof object !== 'object') return null
  if (typeof event.type === 'string' && event.type.startsWith('customer.subscription.')) return idOf(object.id)
  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') return idOf(object.subscription)
  if (event.type === 'checkout.session.completed') return object.mode === 'subscription' ? idOf(object.subscription) : null
  return null
}

/**
 * After the Stripe webhook has committed its own transaction: push the plan of the person the event is about. Flag off: skipped before anything is read. Never throws, so it can never fail the webhook.
 */
export async function pushEntitlementAfterStripeEvent(event: { type?: unknown; data?: { object?: unknown } }): Promise<PushOutcome> {
  if (!routerEntitlementsPushOn(process.env.STUDIO_ROUTER_ENTITLEMENTS_PUSH)) return { skipped: true, reason: 'flag_off' }
  if (typeof event?.type !== 'string' || !ENTITLEMENT_STRIPE_EVENTS.includes(event.type)) return { skipped: true, reason: 'not_an_entitlement_event' }
  const subscriptionId = stripeSubscriptionIdOf(event)
  if (!subscriptionId) return { skipped: true, reason: 'no_subscription' }
  try {
    const row = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionId }, select: { userId: true } })
    if (!row) {
      const outcome: PushOutcome = { skipped: true, reason: 'unknown_subscription' }
      console.log(`[router-entitlements] source=stripe outcome=skipped:unknown_subscription`)
      return outcome
    }
    return await pushEntitlementForUser(row.userId, 'stripe')
  } catch {
    const outcome = fail('failed')
    console.log(`[router-entitlements] source=stripe outcome=error:failed`)
    return outcome
  }
}
