/**
 * The two projections of a question, and the rule that keeps them apart.
 *
 * A `DeckQuestion` row carries operational data the owner needs (what it cost,
 * how confident the model was, which gate fired, the asker's email) alongside
 * the answer text itself. The owner may see all of it. The ASKER may see their
 * own thread — and nothing else on the row.
 *
 * Both projections are built by allowlist, never by deleting fields from the
 * row. A field added to the schema later is therefore invisible to the asker
 * until someone deliberately adds it here, which is the failure direction we
 * want: a new column cannot leak by being forgotten.
 */

import { citationsForViewer, type InternalCitation } from '@/lib/publish/qa-citations'

/** The subset of `DeckQuestion` these functions read. Structural, so both a
 *  Prisma row and a test fixture satisfy it. */
export interface QuestionRow {
  id: string
  question: string
  status: string
  gateReason?: string | null
  aiAnswer?: string | null
  aiCitations?: unknown
  confidence?: number | null
  retrievalTop?: number | null
  modelUsed?: string | null
  tokensIn?: number | null
  tokensOut?: number | null
  costCents?: number | null
  askerEmail?: string | null
  askerName?: string | null
  askerIpHash?: string | null
  ownerAnswer?: string | null
  ownerAnsweredAt?: Date | null
  ownerReadAt?: Date | null
  askerSeenAt?: Date | null
  deckVersion?: number | null
  createdAt: Date
}

export interface FaqRow {
  id: string
  question: string
  answer: string
  citations?: unknown
  sortOrder: number
  published: boolean
  approvedByName: string
  approvedAt: Date
  sourceQuestionId?: string | null
}

export interface ViewerOptions {
  slug: string
  citeWebSources: boolean
  ownerName: string
}

/**
 * Owner view — everything, including the raw citation set with private source
 * names. The owner is the person those documents belong to.
 *
 * `askerIpHash` is deliberately still excluded: it is a rate-limiting key, not
 * information, and showing it would invite treating it as an identity.
 */
export function serializeQuestionForOwner(row: QuestionRow) {
  return {
    id: row.id,
    question: row.question,
    status: row.status,
    gateReason: row.gateReason ?? null,
    aiAnswer: row.aiAnswer ?? null,
    aiCitations: row.aiCitations ?? null,
    confidence: row.confidence ?? null,
    retrievalTop: row.retrievalTop ?? null,
    modelUsed: row.modelUsed ?? null,
    tokensIn: row.tokensIn ?? null,
    tokensOut: row.tokensOut ?? null,
    costCents: row.costCents ?? null,
    askerEmail: row.askerEmail ?? null,
    askerName: row.askerName ?? null,
    ownerAnswer: row.ownerAnswer ?? null,
    ownerAnsweredAt: row.ownerAnsweredAt?.toISOString() ?? null,
    ownerReadAt: row.ownerReadAt?.toISOString() ?? null,
    deckVersion: row.deckVersion ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Asker view — their question, the answer, and nothing operational.
 *
 * The owner's answer takes precedence over the machine's: once a human has
 * replied, that is THE answer, and showing both would invite the reader to
 * treat a superseded machine answer as still standing.
 */
export function serializeThreadForAsker(row: QuestionRow, options: ViewerOptions) {
  const hasOwnerAnswer = !!row.ownerAnswer
  const answer = hasOwnerAnswer ? row.ownerAnswer : row.aiAnswer
  const { citations, provenanceLine } = citationsForViewer(
    row.aiCitations as never,
    options
  )

  return {
    id: row.id,
    question: row.question,
    // 'answered' | 'deferred' | 'owner_answered'. 'blocked' is reported as
    // 'deferred': telling someone they were blocked only teaches them to evade it.
    status: row.status === 'blocked' ? 'deferred' : row.status,
    answer: answer ?? null,
    // Only a human answer carries a name. A machine answer never does.
    answeredBy: hasOwnerAnswer ? options.ownerName : null,
    // An owner's own words are not a retrieval result, so they carry no
    // citations — attaching the machine's would misattribute the evidence.
    citations: hasOwnerAnswer ? [] : citations,
    provenanceLine: hasOwnerAnswer ? null : provenanceLine,
    awaitingOwner: !hasOwnerAnswer && row.status !== 'answered',
    askedAt: row.createdAt.toISOString(),
    answeredAt: row.ownerAnsweredAt?.toISOString() ?? null,
  }
}

/**
 * Public FAQ entry.
 *
 * The stored citations are the REDACTED INTERNAL shape, so filtering them here
 * is both correct and idempotent. It must NOT be handed the viewer projection:
 * a `PublicCitation` carries no `source_kind`, so every entry would fall into
 * T3 — dropping the citations and inventing a "used private material" line on
 * answers grounded purely in slides. See `redactCitationsForStorage`.
 */
export function serializeFaqForViewer(row: FaqRow, options: ViewerOptions) {
  const { citations, provenanceLine } = citationsForViewer(row.citations as never, options)
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    citations,
    provenanceLine,
    // The FAQ is the ONLY text on a published deck carrying the publisher's
    // name, because a human approved it.
    approvedBy: row.approvedByName,
    approvedAt: row.approvedAt.toISOString(),
    sortOrder: row.sortOrder,
  }
}

export function serializeFaqForOwner(row: FaqRow) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    // The REDACTED internal shape, not the viewer projection: T1/T2 intact,
    // T3 collapsed to a bare marker. The owner sees what the row holds, which
    // by construction names nothing private.
    citations: (row.citations ?? null) as InternalCitation[] | null,
    sortOrder: row.sortOrder,
    published: row.published,
    approvedBy: row.approvedByName,
    approvedAt: row.approvedAt.toISOString(),
    sourceQuestionId: row.sourceQuestionId ?? null,
  }
}
