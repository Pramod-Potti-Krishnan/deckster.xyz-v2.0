/**
 * POST /api/publish/[slug]/ask — the public Q&A endpoint.
 *
 * This is the only unauthenticated route in the product that spends money on
 * behalf of a signed-in user. Two properties have to hold no matter what the
 * caller sends:
 *
 *   1. No LLM call happens until every cheap gate has passed. Steps 1–13 below
 *      cost nothing; only step 14 does. That ordering IS the cost model.
 *   2. The response is built from `citationsForViewer`, never from Researcher's
 *      raw citation set — the raw set names the publisher's private documents.
 *
 * Gate order follows QA_RUNG1_SPEC §6.4.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode'
import { citationsForViewer } from '@/lib/publish/qa-citations'
import { askResearcher, isQaBackendConfigured } from '@/lib/publish/qa'
import {
  clientIpFrom,
  evaluateLimits,
  hashAskerIp,
  hashFollowUpToken,
  matchFaq,
  newFollowUpToken,
  normaliseQuestion,
  startOfUtcDay,
  startOfUtcMonth,
  validateQuestion,
  DEDUPE_WINDOW_MS,
  IP_BURST_WINDOW_MS,
} from '@/lib/publish/qa-limits'
import { getQuotaStatus, fitsWithinCaps, type Tier } from '@/lib/quota/quota'
import { tokensToUsdCents } from '@/lib/pricing/tokens'
import { debitWallet, recordPlanUsage, InsufficientFundsError } from '@/lib/wallet'

export const dynamic = 'force-dynamic'

/** Pre-flight estimate. Only used to decide whether we can afford to try; the
 *  actual charge is always the metered usage Researcher reports back. */
const EST_TOKENS = 3000

/**
 * Defers are a 200, not an error: the asker did nothing wrong, the question is
 * recorded, and the owner can still answer it. Only genuine caller faults
 * (missing deck, bad body, rate limit) get a non-200.
 *
 * Every defer carries the follow-up handle. A defer is only worth anything if
 * the eventual answer can reach the person who asked — and for an anonymous
 * asker this token is the ONLY route back. Withholding it on the paths that
 * defer WITHOUT calling a model (corpus not ready, deck capped, Researcher
 * unreachable) would store their question somewhere they can never read the
 * reply from.
 */
function deferResponse(
  slug: string,
  recorded: { id: string; token: string },
  message: string,
  reason: string
) {
  return NextResponse.json({
    status: 'deferred',
    deferReason: reason,
    message,
    citations: [],
    provenanceLine: null,
    followUp: {
      questionId: recorded.id,
      token: recorded.token,
      url: `/p/${slug}/q/${recorded.token}`,
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // 1 — global kill switch. One env var turns Q&A off everywhere without a
    //     deploy touching per-deck settings.
    if (!isQaBackendConfigured()) {
      return NextResponse.json(
        { error: 'Q&A is not available on this deployment' },
        { status: 503 }
      )
    }

    // 2 — the deck must exist and still be published.
    const deck = await prisma.publishedDeck.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        title: true,
        version: true,
        visibility: true,
        passcodeHash: true,
        revokedAt: true,
        qaEnabled: true,
        qaCorpusStatus: true,
        qaCorpusVersion: true,
        qaDailyCap: true,
        qaMonthlyCap: true,
        qaTonePreset: true,
        qaToneInstruction: true,
        qaCiteWebSources: true,
        user: { select: { name: true, tier: true } },
      },
    })
    if (!deck || deck.revokedAt) {
      return NextResponse.json({ error: 'Published deck not found' }, { status: 404 })
    }

    // 3 — restricted decks: the same unlock cookie the page itself requires.
    //     Without this, Q&A would be a side channel that answers questions
    //     about a deck the caller was never allowed to open.
    if (deck.visibility === 'restricted') {
      const cookieStore = await cookies()
      const unlockCookie = cookieStore.get(unlockCookieName(slug))?.value
      if (!verifyUnlockCookie(slug, deck.passcodeHash ?? '', unlockCookie)) {
        return NextResponse.json(
          { error: 'This deck is passcode-protected. Unlock it first.' },
          { status: 401 }
        )
      }
    }

    // 4 — per-deck opt-in. Default false: publishing must never silently
    //     attach a public LLM endpoint to someone's client deck.
    if (!deck.qaEnabled) {
      return NextResponse.json(
        { error: 'Q&A is not enabled for this deck' },
        { status: 403 }
      )
    }

    // 5 — body whitelist. Only these three fields are ever read.
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const question = validateQuestion(body.question)
    if (!question) {
      return NextResponse.json(
        { error: 'A question must be between 3 and 500 characters' },
        { status: 400 }
      )
    }
    const askerEmail =
      typeof body.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 254) : null
    const askerName =
      typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : null

    const ownerName = deck.user?.name?.trim() || 'the deck owner'
    const ipHash = hashAskerIp(clientIpFrom(request.headers))
    const now = new Date()

    // 6/7/8 — block list, per-IP burst, per-deck caps. One grouped query set,
    //     all counts, no model call.
    //
    //     The per-IP counts are deliberately NOT scoped to this deck: an
    //     abusive caller must not get a fresh budget per deck simply by walking
    //     a list of slugs. The cost is that a heavy asker on one publisher's
    //     deck arrives rate-limited at another's — accepted, because the block
    //     list and the per-deck caps below are the deck-scoped controls, and
    //     this one exists purely to bound a single client.
    const [blocked, ipInWindow, ipToday, deckToday, deckThisMonth] = await Promise.all([
      prisma.deckQuestion.count({
        where: { publishedDeckId: deck.id, askerIpHash: ipHash, status: 'blocked' },
      }),
      prisma.deckQuestion.count({
        where: { askerIpHash: ipHash, createdAt: { gte: new Date(now.getTime() - IP_BURST_WINDOW_MS) } },
      }),
      prisma.deckQuestion.count({
        where: { askerIpHash: ipHash, createdAt: { gte: startOfUtcDay(now) } },
      }),
      prisma.deckQuestion.count({
        where: { publishedDeckId: deck.id, createdAt: { gte: startOfUtcDay(now) } },
      }),
      prisma.deckQuestion.count({
        where: { publishedDeckId: deck.id, createdAt: { gte: startOfUtcMonth(now) } },
      }),
    ])

    // ACCEPTED RACE: these counts are read outside a transaction, so N
    // concurrent asks can each see the same sub-cap number and all proceed.
    // The overshoot is bounded by request concurrency, and at ~3c per question
    // a 50/day deck overshooting by even 100 questions costs single-digit
    // dollars. Closing it properly means reserving a row before the model call
    // (two writes instead of one, on the hot path) to make a budget guard exact
    // that was never meant to be a security boundary. Revisit if caps are ever
    // load-bearing for billing rather than for abuse.
    const verdict = evaluateLimits({
      blocked,
      ipInWindow,
      ipToday,
      deckToday,
      deckThisMonth,
      deckDailyCap: deck.qaDailyCap,
      deckMonthlyCap: deck.qaMonthlyCap,
    })
    if (!verdict.allowed) {
      // 'blocked' is silent — an abusive caller learns nothing about why, and
      // gets the same shape as an ordinary rate limit.
      return NextResponse.json(
        {
          error:
            verdict.reason === 'capped'
              ? 'This deck has reached its question limit for now.'
              : 'Too many questions from this connection. Try again shortly.',
        },
        {
          status: 429,
          headers: verdict.retryAfterSeconds
            ? { 'Retry-After': String(verdict.retryAfterSeconds) }
            : undefined,
        }
      )
    }

    // 10 — dedupe before anything expensive. The same asker re-sending the
    //     same question inside the window gets the stored answer back.
    const normalised = normaliseQuestion(question)
    // Scan the window rather than only the latest: asking A, then B, then A
    // again is ordinary behaviour, and matching only the most recent question
    // would miss it and pay for a second identical generation.
    const recentQuestions = await prisma.deckQuestion.findMany({
      where: {
        publishedDeckId: deck.id,
        askerIpHash: ipHash,
        createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
        aiAnswer: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, question: true, aiAnswer: true, aiCitations: true },
      take: 20,
    })
    const recent = recentQuestions.find((row) => normaliseQuestion(row.question) === normalised)
    if (recent?.aiAnswer) {
      const { citations, provenanceLine } = citationsForViewer(
        recent.aiCitations as never,
        { slug, citeWebSources: deck.qaCiteWebSources, ownerName }
      )
      return NextResponse.json({
        status: 'answered',
        source: 'cached',
        answer: recent.aiAnswer,
        citations,
        provenanceLine,
      })
    }

    // 11 — FAQ short-circuit. A human already approved this text, so reusing it
    //     is both free and better than a fresh generation.
    const faqs = await prisma.deckFaqItem.findMany({
      where: { publishedDeckId: deck.id, published: true },
      select: { id: true, question: true, answer: true, citations: true, approvedByName: true },
    })
    const faqHit = matchFaq(question, faqs)
    if (faqHit) {
      const { citations, provenanceLine } = citationsForViewer(
        faqHit.citations as never,
        { slug, citeWebSources: deck.qaCiteWebSources, ownerName }
      )
      return NextResponse.json({
        status: 'answered',
        source: 'faq',
        answer: faqHit.answer,
        approvedBy: faqHit.approvedByName,
        citations,
        provenanceLine,
      })
    }

    // 13 — corpus readiness. A deck whose corpus never froze must defer rather
    //     than answer from nothing.
    if (deck.qaCorpusStatus !== 'ready' && deck.qaCorpusStatus !== 'partial') {
      const recorded = await recordQuestion({
        deckId: deck.id,
        deckVersion: deck.version,
        ipHash,
        question,
        askerEmail,
        askerName,
        status: 'deferred',
        gateReason: 'not_ready',
      })
      return deferResponse(
        slug,
        recorded,
        `That isn't ready to answer automatically yet. I've passed it to ${ownerName}.`,
        'not_ready'
      )
    }

    // 9 — spend pre-flight. Deliberately AFTER the free short-circuits: a
    //     capped deck should still serve FAQ answers and cached answers, since
    //     neither costs anything. It must run BEFORE the model call, so we
    //     never bill for an answer we then refuse to give.
    const ownerTier = (deck.user?.tier || 'free') as Tier
    const quota = await getQuotaStatus(deck.userId, ownerTier)
    const estCents = tokensToUsdCents(EST_TOKENS)
    const affordable =
      fitsWithinCaps(quota.caps, quota.spent, estCents) ||
      quota.walletBalanceCents >= estCents
    if (!affordable) {
      const recorded = await recordQuestion({
        deckId: deck.id,
        deckVersion: deck.version,
        ipHash,
        question,
        askerEmail,
        askerName,
        status: 'deferred',
        gateReason: 'capped',
      })
      return deferResponse(
        slug,
        recorded,
        `I can't answer that automatically right now. I've passed it to ${ownerName}.`,
        'capped'
      )
    }

    // 12/14 — the policy classifier and the gate chain both live in
    //     Researcher, so this single call covers them.
    const deniedRefs = await deniedSourceRefs(deck.id)
    let result
    try {
      result = await askResearcher({
        qaCorpusId: deck.id,
        corpusVersion: deck.qaCorpusVersion ?? 0,
        question,
        deckTitle: deck.title,
        ownerName,
        tonePreset: deck.qaTonePreset,
        toneInstruction: deck.qaToneInstruction,
        excludedSourceRefs: deniedRefs,
      })
    } catch (error) {
      console.error('[Publish QA] Researcher call failed:', error)
      const recorded = await recordQuestion({
        deckId: deck.id,
        deckVersion: deck.version,
        ipHash,
        question,
        askerEmail,
        askerName,
        status: 'deferred',
        gateReason: 'not_ready',
      })
      return deferResponse(
        slug,
        recorded,
        `I couldn't work that out just now. I've passed it to ${ownerName}.`,
        'not_ready'
      )
    }

    // 15 — persist, meter, mint the follow-up token.
    const answered = result.outcome === 'answered' && !!result.answer
    const question_ = await recordQuestion({
      deckId: deck.id,
      deckVersion: deck.version,
      ipHash,
      question,
      askerEmail,
      askerName,
      status: answered ? 'answered' : 'deferred',
      gateReason: result.gate_reason,
      aiAnswer: result.answer,
      // The FULL, tier-blind set. The owner's inbox and the audit trail need
      // every source; only the viewer projection below is filtered.
      aiCitations: result.citations as never,
      confidence: result.confidence,
      retrievalTop: result.retrieval_top,
      modelUsed: result.model_used,
      tokensIn: result.tokens_in,
      tokensOut: result.tokens_out,
    })

    await meterQuestion({
      ownerId: deck.userId,
      questionId: question_.id,
      slug,
      quota,
      tokens: (result.tokens_in || 0) + (result.tokens_out || 0),
    })

    const { citations, provenanceLine } = citationsForViewer(result.citations, {
      slug,
      citeWebSources: deck.qaCiteWebSources,
      ownerName,
    })

    // The follow-up token is returned, not set as a cookie here. The thread
    // cookie is scoped to `/p/{slug}` so it is not sent on every request in the
    // app, which also means the browser does NOT send it to this route — a
    // server-side merge would read an empty list and overwrite the asker's
    // earlier threads on every question. The panel owns the cookie instead
    // (lib/publish/qa-threads.ts), and it is the only reader.
    return NextResponse.json({
      status: answered ? 'answered' : 'deferred',
      source: 'ai',
      deferReason: answered ? undefined : result.gate_reason,
      answer: answered ? result.answer : null,
      message: answered ? null : result.defer_message,
      citations: answered ? citations : [],
      provenanceLine: answered ? provenanceLine : null,
      followUp: {
        questionId: question_.id,
        token: question_.token,
        url: `/p/${slug}/q/${question_.token}`,
      },
    })
  } catch (error) {
    console.error('[Publish QA] ask failed:', error)
    return NextResponse.json({ error: 'Could not process that question' }, { status: 500 })
  }
}

/**
 * The publisher's DENIALS. Publish owns this table — Researcher is never asked
 * to read it, and the knowledge/KG schema is not involved.
 *
 * Denials, not allowances, and the distinction is not academic. This previously
 * sent an ALLOW-list built from stored rows, but a row exists only for a source
 * the owner has actually toggled. Every source without a row — which is most of
 * them — was therefore treated as denied. Touching one entry in the sources
 * panel switched off every slide in the deck, retrieval returned nothing, and
 * the deck answered `no_evidence` to questions plainly covered by its own
 * slides. The publish UI meanwhile *synthesised* defaults for display, so it
 * showed everything as allowed while the filter allowed none of it.
 *
 * A caller can always enumerate what it has DENIED. It cannot enumerate
 * everything it allows, because a source it has never seen is allowed by
 * default. So the deny-list is the only shape that is correct under partial
 * knowledge.
 */
async function deniedSourceRefs(deckId: string): Promise<string[]> {
  const rows = await prisma.publishedDeckSource.findMany({
    where: { publishedDeckId: deckId, allowedForQa: false },
    select: { sourceRef: true },
  })
  return rows.map((row) => row.sourceRef)
}

async function recordQuestion(params: {
  deckId: string
  deckVersion: number
  ipHash: string
  question: string
  askerEmail: string | null
  askerName: string | null
  status: string
  gateReason: string
  aiAnswer?: string | null
  aiCitations?: never
  confidence?: number | null
  retrievalTop?: number | null
  modelUsed?: string | null
  tokensIn?: number | null
  tokensOut?: number | null
}): Promise<{ id: string; token: string }> {
  const token = newFollowUpToken()
  const row = await prisma.deckQuestion.create({
    data: {
      publishedDeckId: params.deckId,
      deckVersion: params.deckVersion,
      askerTokenHash: hashFollowUpToken(token),
      askerIpHash: params.ipHash,
      askerEmail: params.askerEmail,
      askerName: params.askerName,
      question: params.question,
      status: params.status,
      gateReason: params.gateReason,
      aiAnswer: params.aiAnswer ?? null,
      aiCitations: params.aiCitations ?? undefined,
      confidence: params.confidence ?? null,
      retrievalTop: params.retrievalTop ?? null,
      modelUsed: params.modelUsed ?? null,
      tokensIn: params.tokensIn ?? null,
      tokensOut: params.tokensOut ?? null,
    },
    select: { id: true },
  })
  return { id: row.id, token }
}

/**
 * Charge the publisher for what was actually spent.
 *
 * Metered, never estimated, and never taken from the client. Within plan caps
 * this writes a ledger row only; past them it draws on the prepaid wallet.
 *
 * Failures here are logged and swallowed on purpose: we have already paid the
 * provider, and throwing away a good answer over a bookkeeping error would be
 * strictly worse for the asker, the publisher, and us.
 */
async function meterQuestion(params: {
  ownerId: string
  questionId: string
  slug: string
  quota: Awaited<ReturnType<typeof getQuotaStatus>>
  tokens: number
}) {
  if (params.tokens <= 0) return
  const costCents = tokensToUsdCents(params.tokens)
  if (costCents <= 0) return

  const common = {
    userId: params.ownerId,
    amountCents: costCents,
    tokens: params.tokens,
    // Idempotent: a retry of the same question cannot double-charge.
    sourceRef: `deck_qa:${params.questionId}`,
    metadata: { kind: 'deck_qa', slug: params.slug, questionId: params.questionId },
  }
  try {
    if (fitsWithinCaps(params.quota.caps, params.quota.spent, costCents)) {
      await recordPlanUsage(common)
    } else {
      await debitWallet({ ...common, reason: 'token_usage' })
    }
    await prisma.deckQuestion.update({
      where: { id: params.questionId },
      data: { costCents },
    })
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      console.warn('[Publish QA] wallet exhausted after answering:', params.questionId)
      return
    }
    console.error('[Publish QA] metering failed:', error)
  }
}
