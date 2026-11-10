/**
 * POST /api/publish/[slug]/questions/[id]/answer — the owner replies.
 *
 * This is the path that makes deferring acceptable. The machine is tuned to
 * refuse whenever it is unsure, which is only defensible because the refusal
 * lands somewhere a human sees it and can answer properly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findOwnedQuestion, requireDeckOwner, validateOwnerText } from '@/lib/publish/qa-owner'
import { serializeQuestionForOwner } from '@/lib/publish/qa-serialize'

export const dynamic = 'force-dynamic'

const MAX_ANSWER_LENGTH = 4000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const answerText = validateOwnerText(body.answerText, MAX_ANSWER_LENGTH)
    if (!answerText) {
      return NextResponse.json(
        { error: `An answer must be between 1 and ${MAX_ANSWER_LENGTH} characters` },
        { status: 400 }
      )
    }

    const question = await findOwnedQuestion(owned.deck.id, id)
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const updated = await prisma.deckQuestion.update({
      where: { id: question.id },
      data: {
        ownerAnswer: answerText,
        ownerAnsweredAt: new Date(),
        // 'owner_answered' outranks whatever the machine concluded. Answering a
        // question the machine already answered is a correction, and the
        // owner's text is what the asker sees from here on.
        status: 'owner_answered',
        ownerReadAt: question.ownerReadAt ?? new Date(),
      },
    })

    // The asker is notified by returning to their thread link. There is no
    // email provider installed, so nothing is sent — and the UI must not
    // promise otherwise (QA_RUNG1_SPEC §7.2).
    return NextResponse.json({ question: serializeQuestionForOwner(updated) })
  } catch (error) {
    console.error('[Publish QA] owner answer failed:', error)
    return NextResponse.json({ error: 'Could not save the answer' }, { status: 500 })
  }
}
