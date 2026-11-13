import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { meterFeedDebitsWallet } from '@/lib/billing/wallet-debit-source'

export const dynamic = 'force-dynamic'

// BILLING-L5 (FRONTEND-2, B67; L-BILLING F4 = S-2, the Studio half): the receiver of the Model Router's meter feed. POST only.
// Flag STUDIO_METER_RECEIVER_ENABLED (server, runtime, exact "true", default off). Off: a JSON 404 before the body, a header or any other environment value is read.
// On, the mode is METER_RECEIVER_MODE: "apply" exactly, else "receipt_only" (the default).
//
// The router's contract (model-router docs/METER_FEED.md, confirmed by ROUTER-2 on 8 Nov against router uat b3a65fad):
//   headers X-MR-Timestamp (Unix seconds) and X-MR-Signature: sha256=<lowercase hex>, the hex being HMAC-SHA256(METER_WEBHOOK_SECRET, timestamp + "." + the RAW request body);
//   the raw bytes are verified before anything is parsed, compared with crypto.timingSafeEqual, inside a window of 300 s either way. A missing or bad signature is 401 (it is not a feed event).
//   Any 2xx acknowledges (a duplicate too); 5xx, 408 and 429 are retried on the router's schedule; ANY other 4xx dead-letters the event at once. So once the signature is valid this route
//   NEVER answers 4xx: an event it cannot use yet, or a failure on Studio's side (database down, the wallet helper throws), is a 503 and the router retries it.
//   Body: the usage event. Unknown keys are ignored. Today it has NO from_topup: the split (from_topup, from_plan, overdraft, in credits, fixed-point decimal strings) comes with a router change
//   after Sunday (RW-32). Until then from_topup is absent.
// Dedupe key: generation_id when present, otherwise event_id (METER_FEED.md's rule); the wallet sourceRef is meter:<generation_id or event_id>. event_id is the usage row's UUID, constant through
// retries and admin replays.
//
// receipt_only (default): verify, read the event, answer 200 { received: true, applied: false }. It writes NOTHING: no database, no wallet, no migration (UAT's database is the shared production Supabase).
// apply: only while the wallet debit source switch says the router meter is the debit source (meterFeedDebitsWallet(), lib/billing/wallet-debit-source.ts; otherwise the flat debit already charged this
// usage, so the event is acknowledged with applied: false). Then from_topup (1 credit = 1 cent) is DEBITED from the wallet through lib/wallet.ts's idempotent debitWallet, sourceRef as above, reason
// token_usage: the existing tables and the unique sourceRef, nothing new. An explicit zero, or no user (the router's rule: never invent a debit), is acknowledged with nothing debited. from_topup
// ABSENT, malformed, finer than a whole credit (no sub-cent ruling yet) or out of range: 503, logged as a configuration error, so the router keeps retrying and no debit is lost by a 200.
// The wallet module is loaded only in apply mode. Logs carry the event id, the mode and an outcome word only: never the body, an amount, a user, a header or the secret.
//
// RUNBOOK (OPS-2):
//   - Do NOT enable STUDIO_METER_RECEIVER_ENABLED until durable storage or apply exists: receipt_only acknowledges without durable storage, and an acknowledged event is never re-queued.
//     While the flag is off (404), the router keeps every event as a dead letter, which can be replayed.
//   - Do NOT set METER_RECEIVER_MODE=apply before the router's post-Sunday from_topup change (RW-32) and a ruling on sub-cent amounts; until then apply answers 503 to every event.
//   - Any 4xx, the 401 included, dead-letters an event (the router keeps its payload). After a secret mismatch: fix METER_WEBHOOK_SECRET, then OPS-2 runs the router's admin replay
//     (POST /v1/admin/meter/outbox/{event_id}/replay, or the bulk replay route). The router re-signs every attempt, so retries never arrive stale.

/** The router refuses nothing bigger; a meter event is a few hundred bytes. */
const MAX_BODY_BYTES = 16384
/** The router's clock-skew window (METER_FEED.md). */
const MAX_SKEW_SECONDS = 300
const TIMESTAMP_HEADER = 'x-mr-timestamp'
const SIGNATURE_HEADER = 'x-mr-signature'
const SIGNATURE_PREFIX = 'sha256='
const TIMESTAMP = /^[0-9]{1,12}$/
const SIGNATURE = /^sha256=[0-9a-f]{64}$/
const SECRET_SHAPE = /^[\x21-\x7e]{8,512}$/
/** An event id the receiver will use as a key and log: the router's usage UUID, or any short plain id. */
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
/** A generation id used as the dedupe key: visible ASCII, no space, at most 255 characters. Anything else falls back to event_id. */
const GENERATION_ID = /^[\x21-\x7e]{1,255}$/
/** The router's user id format; any other value is treated as no user (never a 4xx). */
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
  const given = Buffer.from(signature.slice(SIGNATURE_PREFIX.length), 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

type TopupPart = { kind: 'absent' } | { kind: 'invalid' } | { kind: 'micro'; micro: bigint }

interface MeterEvent {
  eventId: string
  /** generation_id when it is usable, otherwise event_id. */
  dedupeKey: string
  userId: string | null
  topup: TopupPart
}

/** The fields the receiver uses; null when the body is not a meter event at all (not a JSON object, or no usable event_id). Every other key is ignored and never copied. */
function readEvent(raw: Buffer): MeterEvent | null {
  let body: unknown
  try { body = JSON.parse(raw.toString('utf8')) } catch { return null }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const event = body as Record<string, unknown>
  if (typeof event.event_id !== 'string' || !EVENT_ID.test(event.event_id)) return null
  const generation = typeof event.generation_id === 'string' && GENERATION_ID.test(event.generation_id) ? event.generation_id : null
  const userId = typeof event.user_id === 'string' && USER_ID.test(event.user_id) ? event.user_id : null
  let topup: TopupPart = { kind: 'absent' }
  if (event.from_topup !== undefined && event.from_topup !== null) {
    if (typeof event.from_topup !== 'string' || !DECIMAL.test(event.from_topup)) topup = { kind: 'invalid' }
    else {
      const [whole, fraction = ''] = event.from_topup.split('.')
      topup = /[1-9]/.test(fraction.slice(6)) ? { kind: 'invalid' } : { kind: 'micro', micro: BigInt(whole) * BigInt(1000000) + BigInt((fraction + '000000').slice(0, 6)) }
    }
  }
  return { eventId: event.event_id, dedupeKey: generation ?? event.event_id, userId, topup }
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
    if (!signatureValid(secret, request.headers.get(TIMESTAMP_HEADER), request.headers.get(SIGNATURE_HEADER), raw, Math.floor(Date.now() / 1000))) {
      log(null, mode, 'bad_signature')
      return respond(401, { error: 'invalid_signature' })
    }
    // From here on the router signed this body: never a 4xx (it would dead-letter the event).
    const event = readEvent(raw)
    if (!event) {
      log(null, mode, 'error:invalid_event')
      return respond(503, { error: 'invalid_meter_event' })
    }
    const sourceRef = `meter:${event.dedupeKey}`

    if (mode === 'receipt_only') {
      log(event.eventId, mode, 'received')
      return respond(200, { received: true, applied: false })
    }
    if (!meterFeedDebitsWallet()) {
      log(event.eventId, mode, 'not_applied:debit_source_not_router')
      return respond(200, { received: true, applied: false, reason: 'debit_source_not_router' })
    }
    if (event.topup.kind === 'absent') {
      log(event.eventId, mode, 'config_error:from_topup_absent')
      return respond(503, { error: 'from_topup_absent' }) // apply before the router sends the split: retried, never acknowledged, so no debit is lost
    }
    if (event.topup.kind === 'invalid') {
      log(event.eventId, mode, 'config_error:from_topup_invalid')
      return respond(503, { error: 'from_topup_invalid' })
    }
    if (event.userId === null) {
      log(event.eventId, mode, 'not_applied:unattributed')
      return respond(200, { received: true, applied: false, reason: 'unattributed' })
    }
    if (event.topup.micro === BigInt(0)) {
      log(event.eventId, mode, 'not_applied:no_topup_part')
      return respond(200, { received: true, applied: false, reason: 'no_topup_part' })
    }
    if (event.topup.micro % BigInt(1000000) !== BigInt(0)) {
      log(event.eventId, mode, 'config_error:sub_cent_unruled')
      return respond(503, { error: 'sub_cent_unruled' }) // a cents wallet cannot hold it until PK / ROUTER-2 rule; retried, not dead-lettered
    }
    const cents = event.topup.micro / BigInt(1000000)
    if (cents > BigInt(MAX_APPLY_CENTS)) {
      log(event.eventId, mode, 'config_error:amount_out_of_range')
      return respond(503, { error: 'amount_out_of_range' })
    }
    const { debitWallet, InsufficientFundsError } = await import('@/lib/wallet')
    try {
      await debitWallet({ userId: event.userId, amountCents: Number(cents), reason: 'token_usage', sourceRef, metadata: { source: 'meter', eventId: event.eventId } })
    } catch (error) {
      // Every failure of the wallet helper is retried (503): the sourceRef keeps a retry from charging twice.
      const outcome = error instanceof InsufficientFundsError ? 'insufficient_balance' : (error as { code?: unknown } | null)?.code === 'P2025' ? 'unknown_user' : 'apply_failed'
      log(event.eventId, mode, `error:${outcome}`)
      return respond(503, { error: 'meter_apply_failed' })
    }
    log(event.eventId, mode, 'applied')
    return respond(200, { received: true, applied: true })
  } catch {
    log(null, mode, 'error:failed')
    return respond(500, { error: 'meter_receiver_failed' })
  }
}
