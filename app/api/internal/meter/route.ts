import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { meterFeedDebitsWallet } from '@/lib/billing/wallet-debit-source'

export const dynamic = 'force-dynamic'

// BILLING-L5 (FRONTEND-2, B67; L-BILLING F4 = S-2, the Studio half): the receiver of the Model Router's meter feed. POST only.
// Flag STUDIO_METER_RECEIVER_ENABLED (server, runtime, exact "true", default off). Off: 404 before the body, a header or any other environment value is read, as if the route did not exist.
// On, the mode is METER_RECEIVER_MODE: "apply" exactly, else "receipt_only" (the default).
//
// The router's contract (model-router docs/METER_FEED.md; ROUTER-2 to confirm the split field below):
//   headers X-MR-Timestamp (Unix seconds) and X-MR-Signature: sha256=<lowercase hex>, where the hex is HMAC-SHA256(METER_WEBHOOK_SECRET, timestamp + "." + the RAW request body);
//   the raw bytes are verified before anything is parsed; the comparison is crypto.timingSafeEqual; a timestamp more than 300 s from now is refused. A missing or bad signature is 401.
//   Any 2xx acknowledges (a duplicate too); 5xx, 408 and 429 are retried by the router; any other 4xx dead-letters the event at once (it stays replayable).
//   Body: the usage event (event_id, user_id, status, ts, ... and, from the router's MR-4, from_topup: the credits of this call taken from the person's top-up balance). Unknown keys are ignored.
// Idempotency key: meter:<event_id> (the router keeps event_id constant through retries and replays).
//
// receipt_only (default): verify, validate, answer 200 { received: true, applied: false }. It writes NOTHING: no database, no wallet, no migration (UAT's database is the shared production Supabase).
// apply: only while the wallet debit source switch says the router meter is the debit source (meterFeedDebitsWallet(), lib/billing/wallet-debit-source.ts; otherwise the flat debit already charged this usage and
// applying it would charge twice, so the event is acknowledged with applied: false). Then from_topup (1 credit = 1 cent) is DEBITED from the wallet through lib/wallet.ts's idempotent debitWallet,
// sourceRef meter:<event_id>, reason token_usage: the existing tables and the unique sourceRef, nothing new. Only whole credits are applied: a fractional from_topup is refused (422, dead-lettered and replayable)
// until PK / ROUTER-2 rule how sub-cent amounts reach a cents wallet. No user id: acknowledged, nothing debited (the router's rule: never invent a debit). The wallet module is loaded only in apply mode.
// Logs carry the event id, the mode and an outcome word only: never the body, an amount, a user, a header or the secret.

/** The router refuses nothing bigger; a meter event is a few hundred bytes. */
const MAX_BODY_BYTES = 16384
/** The router's clock-skew window (METER_FEED.md). */
const MAX_SKEW_SECONDS = 300
const TIMESTAMP = /^[0-9]{1,12}$/
const SIGNATURE = /^sha256=[0-9a-f]{64}$/
const SECRET_SHAPE = /^[\x21-\x7e]{8,512}$/
/** An event id the receiver will use as a key and log: the router's usage UUID, or any short plain id. */
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
/** The router's user id format. */
const USER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/
/** A plain fixed-point decimal: the router sends no sign and no exponent. */
const DECIMAL = /^\d{1,15}(?:\.\d{1,10})?$/
/** One event never moves more than this many cents (a sanity bound, far above any real call). */
const MAX_APPLY_CENTS = 1_000_000

type Mode = 'receipt_only' | 'apply'

const respond = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

function log(eventId: string | null, mode: Mode, outcome: string): void {
  console.log(`[meter-receiver] event=${eventId ?? '-'} mode=${mode} outcome=${outcome}`)
}

/** The signature check over the RAW bytes: the timestamp's shape and window, the header's shape, then a constant-time comparison of the two digests. */
function signatureValid(secret: string, timestamp: string | null, signature: string | null, raw: Buffer, nowSeconds: number): boolean {
  if (!timestamp || !TIMESTAMP.test(timestamp) || !signature || !SIGNATURE.test(signature)) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest()
  const given = Buffer.from(signature.slice('sha256='.length), 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

interface MeterEvent {
  eventId: string
  userId: string | null
  /** Millionths of a credit taken from the top-up balance; null when the event carries no split. */
  fromTopupMicro: bigint | null
}

/** The fields the receiver uses, checked; null when the event is not the contract. Every other key is ignored and never copied. */
function parseEvent(raw: Buffer): MeterEvent | null {
  let body: unknown
  try { body = JSON.parse(raw.toString('utf8')) } catch { return null }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const event = body as Record<string, unknown>
  if (typeof event.event_id !== 'string' || !EVENT_ID.test(event.event_id)) return null
  if (event.user_id !== null && event.user_id !== undefined && (typeof event.user_id !== 'string' || !USER_ID.test(event.user_id))) return null
  if (typeof event.status !== 'string' || typeof event.ts !== 'string') return null
  let fromTopupMicro: bigint | null = null
  if (event.from_topup !== undefined && event.from_topup !== null) {
    if (typeof event.from_topup !== 'string' || !DECIMAL.test(event.from_topup)) return null
    const [whole, fraction = ''] = event.from_topup.split('.')
    if (/[1-9]/.test(fraction.slice(6))) return null // finer than a millionth of a credit is not the contract (the router keeps six places)
    fromTopupMicro = BigInt(whole) * BigInt(1000000) + BigInt((fraction + '000000').slice(0, 6))
  }
  return { eventId: event.event_id, userId: typeof event.user_id === 'string' ? event.user_id : null, fromTopupMicro }
}

export async function POST(request: Request) {
  if (process.env.STUDIO_METER_RECEIVER_ENABLED !== 'true') return respond(404, { error: 'Not found' })
  const mode: Mode = process.env.METER_RECEIVER_MODE === 'apply' ? 'apply' : 'receipt_only'
  try {
    const secret = process.env.METER_WEBHOOK_SECRET ?? ''
    if (!SECRET_SHAPE.test(secret)) {
      log(null, mode, 'unconfigured')
      return respond(503, { error: 'meter_receiver_unconfigured' }) // retried by the router: the event is not lost while the secret is missing
    }
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      log(null, mode, 'too_large')
      return respond(413, { error: 'request_too_large' })
    }
    const raw = Buffer.from(await request.arrayBuffer())
    if (raw.length > MAX_BODY_BYTES) {
      log(null, mode, 'too_large')
      return respond(413, { error: 'request_too_large' })
    }
    if (!signatureValid(secret, request.headers.get('x-mr-timestamp'), request.headers.get('x-mr-signature'), raw, Math.floor(Date.now() / 1000))) {
      log(null, mode, 'bad_signature')
      return respond(401, { error: 'invalid_signature' })
    }
    const event = parseEvent(raw)
    if (!event) {
      log(null, mode, 'invalid_event')
      return respond(422, { error: 'invalid_meter_event' })
    }
    const sourceRef = `meter:${event.eventId}`

    if (mode === 'receipt_only') {
      log(event.eventId, mode, 'received')
      return respond(200, { received: true, applied: false })
    }
    if (!meterFeedDebitsWallet()) {
      log(event.eventId, mode, 'not_applied:debit_source_not_router')
      return respond(200, { received: true, applied: false, reason: 'debit_source_not_router' })
    }
    if (event.userId === null) {
      log(event.eventId, mode, 'not_applied:unattributed')
      return respond(200, { received: true, applied: false, reason: 'unattributed' })
    }
    if (event.fromTopupMicro === null || event.fromTopupMicro === BigInt(0)) {
      log(event.eventId, mode, 'not_applied:no_topup_part')
      return respond(200, { received: true, applied: false, reason: 'no_topup_part' })
    }
    if (event.fromTopupMicro % BigInt(1000000) !== BigInt(0)) {
      log(event.eventId, mode, 'refused:fractional_credits')
      return respond(422, { error: 'fractional_credits' })
    }
    const cents = event.fromTopupMicro / BigInt(1000000)
    if (cents > BigInt(MAX_APPLY_CENTS)) {
      log(event.eventId, mode, 'refused:amount_out_of_range')
      return respond(422, { error: 'amount_out_of_range' })
    }
    const { debitWallet, InsufficientFundsError } = await import('@/lib/wallet')
    try {
      await debitWallet({ userId: event.userId, amountCents: Number(cents), reason: 'token_usage', sourceRef, metadata: { source: 'meter', eventId: event.eventId } })
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        log(event.eventId, mode, 'refused:insufficient_balance')
        return respond(409, { error: 'insufficient_wallet_balance' }) // the mirror has drifted from the router: dead-lettered, replayable after the reconcile
      }
      if ((error as { code?: unknown } | null)?.code === 'P2025') {
        log(event.eventId, mode, 'refused:unknown_user')
        return respond(422, { error: 'unknown_user' })
      }
      log(event.eventId, mode, 'error:apply_failed')
      return respond(503, { error: 'meter_apply_failed' }) // retried by the router; the sourceRef keeps a retry from charging twice
    }
    log(event.eventId, mode, 'applied')
    return respond(200, { received: true, applied: true })
  } catch {
    log(null, mode, 'error:failed')
    return respond(500, { error: 'meter_receiver_failed' })
  }
}
