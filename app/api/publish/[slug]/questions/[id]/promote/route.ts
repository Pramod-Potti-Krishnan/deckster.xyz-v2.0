/**
 * POST /api/publish/[slug]/questions/[id]/promote — publish an answer as FAQ.
 *
 * The FAQ is the only text on a published deck that carries the publisher's
 * name, so this route is the single point where a human's byline attaches to
 * machine-drafted words. Two consequences shape the whole file:
 *
 *   1. Promoting a MACHINE answer requires the answer text in the body. The
 *      spec asks that `aiAnswer` only be promotable "after the owner opens the
 *      edit form"; a client-side form cannot be trusted to have been opened, so
 *      the server demands the text itself. Sending it back is the act of
 *      approval, and the byline then attaches to words the owner actually
 *      submitted. An owner's own answer needs no such proof.
 *   2. Citations are stored REDACTED, not projected. The FAQ is public text, so
 *      a private filename must never land in the row — but storing the viewer
 *      projection would type-confuse the read filter, which filters again and
 *      would drop every citation while inventing a "used private material" line
 *      on answers grounded purely in slides. Redaction keeps the internal shape
 *      so re-filtering stays correct and idempotent. See
 *      `redactCitationsForStorage`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { findOwnedQuestion, requireDeckOwner, validateOwnerText } from '@/lib/publish/qa-owner'
import { redactCitationsForStorage } from '@/lib/publish/qa-citations'
import { serializeFaqForOwner } from '@/lib/publish/qa-serialize'

export const dynamic = 'force-dynamic'

const MAX_QUESTION_LENGTH = 500
const MAX_ANSWER_LENGTH = 4000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const body = (await request.json().catch(() => ({}))) ?? {}
    if (typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const question = await findOwnedQuestion(owned.deck.id, id)
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const overrideAnswer =
      body.answer === undefined ? null : validateOwnerText(body.answer, MAX_ANSWER_LENGTH)
    if (body.answer !== undefined && !overrideAnswer) {
      return NextResponse.json(
        { error: `An answer must be between 1 and ${MAX_ANSWER_LENGTH} characters` },
        { status: 400 }
      )
    }

    // (1) — a machine answer may only be published under a human's name if that
    // human sent the text.
    if (!overrideAnswer && !question.ownerAnswer) {
      return NextResponse.json(
        {
          error:
            'Review the answer before publishing it. Send the approved text to publish it ' +
            'to the FAQ under your name.',
        },
        { status: 400 }
      )
    }
    const answer = overrideAnswer ?? question.ownerAnswer!

    const overrideQuestion =
      body.question === undefined ? null : validateOwnerText(body.question, MAX_QUESTION_LENGTH)
    if (body.question !== undefined && !overrideQuestion) {
      return NextResponse.json(
        { error: `A question must be between 1 and ${MAX_QUESTION_LENGTH} characters` },
        { status: 400 }
      )
    }
    const faqQuestion = overrideQuestion ?? question.question

    // (2) — REDACT at write time rather than project. The FAQ is public, so a
    // private filename must never land in the row; but storing the viewer
    // projection instead would type-confuse the read filter, which re-filters
    // and would drop every citation while inventing a "used private material"
    // line. Redaction keeps the internal shape (so re-filtering is correct and
    // idempotent) while carrying nothing to leak.
    const citations = redactCitationsForStorage(question.aiCitations as never)
    // Round-trip through JSON so optional fields that are `undefined` are
    // dropped rather than stored, and what lands in the column is plain data.
    const citationsJson = JSON.parse(JSON.stringify(citations)) as Prisma.InputJsonValue

    const sortOrder =
      typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
        ? Math.trunc(body.sortOrder)
        : await nextSortOrder(owned.deck.id)

    // Upsert, not create: re-promoting after an edit is ordinary, and
    // `sourceQuestionId` is unique so a second create would 500 on a
    // constraint violation.
    const faq = await prisma.deckFaqItem.upsert({
      where: { sourceQuestionId: question.id },
      create: {
        publishedDeckId: owned.deck.id,
        sourceQuestionId: question.id,
        question: faqQuestion,
        answer,
        citations: citationsJson,
        sortOrder,
        published: true,
        // Denormalised so the byline survives a later profile rename.
        approvedByName: owned.deck.ownerName,
      },
      update: {
        question: faqQuestion,
        answer,
        citations: citationsJson,
        sortOrder,
        published: true,
        approvedByName: owned.deck.ownerName,
      },
    })

    // Promotion is also the recovery path for a thread whose asker lost their
    // link, so the answer is recorded on the question too.
    if (!question.ownerAnswer) {
      await prisma.deckQuestion.update({
        where: { id: question.id },
        data: { ownerAnswer: answer, ownerAnsweredAt: new Date(), status: 'owner_answered' },
      })
    }

    return NextResponse.json({ faq: serializeFaqForOwner(faq) })
  } catch (error) {
    console.error('[Publish QA] promote failed:', error)
    return NextResponse.json({ error: 'Could not publish that to the FAQ' }, { status: 500 })
  }
}

async function nextSortOrder(deckId: string): Promise<number> {
  const last = await prisma.deckFaqItem.findFirst({
    where: { publishedDeckId: deckId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? -1) + 1
}
