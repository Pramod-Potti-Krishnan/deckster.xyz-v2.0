/**
 * DELETE /api/publish/[slug]/questions/[id] — remove a question.
 *
 * A hard delete, deliberately. This is the owner's remedy for abusive or
 * personal content arriving on a public endpoint they opened, and a soft delete
 * that keeps the text would not be a remedy.
 *
 * Any FAQ entry promoted from it survives — `sourceQuestionId` is ON DELETE SET
 * NULL. The published answer is the publisher's own approved text; deleting the
 * question that prompted it should not silently retract it from the deck.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findOwnedQuestion, requireDeckOwner } from '@/lib/publish/qa-owner'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const question = await findOwnedQuestion(owned.deck.id, id)
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    await prisma.deckQuestion.delete({ where: { id: question.id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[Publish QA] delete question failed:', error)
    return NextResponse.json({ error: 'Could not delete that question' }, { status: 500 })
  }
}
