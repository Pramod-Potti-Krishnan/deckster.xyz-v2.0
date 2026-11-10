/**
 * Asker identity, rate limiting, and dedupe for public deck Q&A.
 *
 * `/ask` is the only unauthenticated endpoint in the product that spends the
 * publisher's money. Every function here exists to make one of two things true:
 * an abusive caller cannot drain a wallet, and an asker cannot be identified
 * from anything we store.
 *
 * The decision functions are pure — they take counts and return a verdict — so
 * the limits can be tested without a database. The route does the I/O.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Per-visitor limits. Deliberately tighter than the per-deck caps: one visitor
 * should never be able to exhaust a deck's daily budget alone.
 *
 * These are DEFAULTS. Each deck carries its own pair (`qaVisitorBurstLimit` /
 * `qaVisitorDailyLimit`), because a deck on stage at a conference and a quiet
 * client deck want very different numbers and only the owner knows which they
 * have. The env vars remain as a deployment-wide floor for decks created before
 * the columns existed.
 *
 * The window is fixed at 5 minutes: it is the unit the owner-facing setting is
 * phrased in ("N questions every 5 minutes"), so making it adjustable too would
 * turn one legible number into two that interact.
 */
export const IP_BURST_LIMIT = Number(process.env.QA_IP_BURST_LIMIT ?? 10)
export const IP_BURST_WINDOW_MS = 5 * 60 * 1000
export const IP_DAILY_LIMIT = Number(process.env.QA_IP_DAILY_LIMIT ?? 40)

/**
 * Bounds on what an owner may choose.
 *
 * The floor is 1, never 0: a deck that accepts questions but refuses every one
 * of them on arrival is worse than a deck with Q&A switched off, and the switch
 * already exists. There is no "unlimited" — this endpoint spends money without
 * authentication, so some ceiling has to survive any setting.
 */
export const VISITOR_BURST_MIN = 1
export const VISITOR_BURST_MAX = 60
export const VISITOR_DAILY_MIN = 1
export const VISITOR_DAILY_MAX = 500

/** Clamp an owner-supplied limit. Out-of-range lands on a safe number rather
 *  than being rejected — a nonsense value must not leave the deck on whatever
 *  (possibly higher) value it had before. */
export function clampVisitorBurst(value: number): number {
  return Math.min(VISITOR_BURST_MAX, Math.max(VISITOR_BURST_MIN, Math.trunc(value)))
}

export function clampVisitorDaily(value: number): number {
  return Math.min(VISITOR_DAILY_MAX, Math.max(VISITOR_DAILY_MIN, Math.trunc(value)))
}

/** Dedupe window — the same person re-asking the same thing gets the same
 *  answer back without a second model call. */
export const DEDUPE_WINDOW_MS = 60 * 60 * 1000

/**
 * Above this lexical overlap with a published FAQ entry, answer from the FAQ
 * and skip the model entirely. High on purpose: a human approved that text and
 * it carries the publisher's byline, so it may only be reused for a question
 * that is effectively the same one.
 *
 * At this threshold, token-set Jaccard means in practice **an identical token
 * set** — a 12-word question that differs by one word scores 0.917 and misses.
 * That is the intended strictness, not an accident of the number: the cost of
 * missing is one model call, and the cost of a false match is the publisher's
 * name on an answer to a question nobody asked.
 */
export const FAQ_MATCH_THRESHOLD = 0.92

export const QUESTION_MIN_LENGTH = 3
export const QUESTION_MAX_LENGTH = 500

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET
  if (!value) {
    throw new Error('NEXTAUTH_SECRET must be configured for published-deck Q&A')
  }
  return value
}

/**
 * Pseudonymise the asker's IP.
 *
 * Keyed HMAC, not a bare hash: the IPv4 space is small enough to enumerate
 * completely, so an unkeyed sha256 of an IP is reversible by brute force in
 * seconds and would be personal data in storage. With the app secret as the
 * key it is not reversible without the key.
 */
export function hashAskerIp(ip: string): string {
  return createHmac('sha256', secret()).update(`qa-ip:${ip.trim()}`).digest('hex')
}

/**
 * Best-effort client IP. Behind Vercel, `x-forwarded-for` is set by the proxy;
 * the FIRST entry is the client. Falls back to a constant, which fails SAFE:
 * unknown callers share one bucket and collectively hit the limit sooner.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

/** 43 unguessable chars. The raw token never touches the database. */
export function newFollowUpToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashFollowUpToken(token: string): string {
  return createHmac('sha256', secret()).update(`qa-token:${token}`).digest('hex')
}

/** Constant-time compare for token hashes, so lookup timing leaks nothing. */
export function followUpTokenMatches(token: string, storedHash: string): boolean {
  try {
    const actual = Buffer.from(hashFollowUpToken(token), 'hex')
    const expected = Buffer.from(storedHash, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function followUpCookieName(slug: string): string {
  return `dq_${slug}`
}

// ---------------------------------------------------------------------------
// Question normalisation
// ---------------------------------------------------------------------------

/**
 * Canonical form for dedupe and FAQ matching: lowercase, punctuation dropped,
 * whitespace collapsed. "What's the pricing?" and "what is the pricing" do NOT
 * collapse together — expanding contractions would be a guess, and the cost of
 * missing a dedupe is one extra model call, while the cost of a wrong FAQ match
 * is the publisher's name on an answer to a question nobody asked.
 */
export function normaliseQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lexical (token-set) similarity in [0, 1].
 *
 * Deliberately NOT semantic: embedding the question would mean a model call
 * before the cost gates have run, which inverts the whole point of the cheap
 * prefix. Lexical matching under-matches — a paraphrase misses the FAQ and
 * costs one model call. That is the right direction to be wrong in.
 */
export function questionSimilarity(a: string, b: string): number {
  const left = new Set(normaliseQuestion(a).split(' ').filter(Boolean))
  const right = new Set(normaliseQuestion(b).split(' ').filter(Boolean))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / (left.size + right.size - shared)
}

export interface FaqCandidate {
  id: string
  question: string
  answer: string
  citations: unknown
  approvedByName: string
}

/** The best FAQ match at or above the threshold, or null. */
export function matchFaq(question: string, faqs: FaqCandidate[]): FaqCandidate | null {
  let best: FaqCandidate | null = null
  let bestScore = 0
  for (const faq of faqs) {
    const score = questionSimilarity(question, faq.question)
    if (score >= FAQ_MATCH_THRESHOLD && score > bestScore) {
      best = faq
      bestScore = score
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Limit decisions — pure
// ---------------------------------------------------------------------------

export type LimitVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'blocked' | 'rate_limited' | 'capped'; retryAfterSeconds?: number }

export function validateQuestion(question: unknown): string | null {
  if (typeof question !== 'string') return null
  const trimmed = question.trim()
  if (trimmed.length < QUESTION_MIN_LENGTH || trimmed.length > QUESTION_MAX_LENGTH) return null
  return trimmed
}

/**
 * Order matters and mirrors §6.4: a blocked asker is rejected before any
 * counting, and per-IP limits are checked before per-deck ones so one abuser
 * cannot make a deck look "capped" to everyone else.
 */
export function evaluateLimits(counts: {
  blocked: number
  ipInWindow: number
  ipToday: number
  deckToday: number
  deckThisMonth: number
  deckDailyCap: number
  deckMonthlyCap: number
  /** This deck's own per-visitor limits. Absent → the deployment defaults. */
  visitorBurstLimit?: number
  visitorDailyLimit?: number
  /** The signed-in owner of THIS deck. Exempt from the per-visitor limits. */
  isOwner?: boolean
}): LimitVerdict {
  if (counts.blocked > 0) return { allowed: false, reason: 'blocked' }

  const burstLimit = counts.visitorBurstLimit ?? IP_BURST_LIMIT
  const dailyLimit = counts.visitorDailyLimit ?? IP_DAILY_LIMIT

  // The per-visitor limits bound an ANONYMOUS client hammering a public
  // endpoint. The deck's own owner is not that: they are signed in, they are
  // verified against deck.userId, and they are paying for every answer.
  // Rate-limiting them on their own deck made testing it impossible — a handful
  // of questions and the publisher is locked out of their own feature.
  //
  // The per-DECK caps below still apply, because those are the spend ceiling
  // the owner set for themselves and are the thing actually bounding cost.
  if (!counts.isOwner && counts.ipInWindow >= burstLimit) {
    return {
      allowed: false,
      reason: 'rate_limited',
      retryAfterSeconds: Math.ceil(IP_BURST_WINDOW_MS / 1000),
    }
  }
  if (!counts.isOwner && counts.ipToday >= dailyLimit) {
    return { allowed: false, reason: 'rate_limited', retryAfterSeconds: 3600 }
  }

  if (counts.deckToday >= counts.deckDailyCap) return { allowed: false, reason: 'capped' }
  if (counts.deckThisMonth >= counts.deckMonthlyCap) return { allowed: false, reason: 'capped' }

  return { allowed: true }
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
