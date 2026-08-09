/**
 * PATCH/DELETE /api/publish/[slug]/faq/[faqId] — edit, reorder, unpublish, remove.
 *
 * Editing an FAQ entry re-stamps the byline with the CURRENT owner name, since
 * the edited text is newly approved. Everything here is owner-only: the FAQ is
 * public text under a human's name, and nobody else may put words there.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findOwnedFaq, requireDeckOwner, validateOwnerText } from '@/lib/publish/qa-owner'
import { serializeFaqForOwner } from '@/lib/publish/qa-serialize'

export const dynamic = 'force-dynamic'

const MAX_QUESTION_LENGTH = 500
const MAX_ANSWER_LENGTH = 4000

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; faqId: string }> }
) {
  try {
    const { slug, faqId } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const existing = await findOwnedFaq(owned.deck.id, faqId)
    if (!existing) {
      return NextResponse.json({ error: 'FAQ entry not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Explicit whitelist. `citations` is NOT editable here: they are evidence
    // carried from the answer, not prose, and letting a client post arbitrary
    // citation objects would make the deep-link targets attacker-controlled.
    const data: {
      question?: string
      answer?: string
      sortOrder?: number
      published?: boolean
      approvedByName?: string
    } = {}

    if (body.question !== undefined) {
      const question = validateOwnerText(body.question, MAX_QUESTION_LENGTH)
      if (!question) {
        return NextResponse.json(
          { error: `A question must be between 1 and ${MAX_QUESTION_LENGTH} characters` },
          { status: 400 }
        )
      }
      data.question = question
    }
    if (body.answer !== undefined) {
      const answer = validateOwnerText(body.answer, MAX_ANSWER_LENGTH)
      if (!answer) {
        return NextResponse.json(
          { error: `An answer must be between 1 and ${MAX_ANSWER_LENGTH} characters` },
          { status: 400 }
        )
      }
      data.answer = answer
    }
    if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
      data.sortOrder = Math.trunc(body.sortOrder)
    }
    if (typeof body.published === 'boolean') data.published = body.published

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Re-approving: edited text is newly approved, so it carries the byline the
    // owner has now, not the one they had when it was first promoted.
    if (data.question !== undefined || data.answer !== undefined) {
      data.approvedByName = owned.deck.ownerName
    }

    const updated = await prisma.deckFaqItem.update({ where: { id: existing.id }, data })
    return NextResponse.json({ faq: serializeFaqForOwner(updated) })
  } catch (error) {
    console.error('[Publish QA] faq update failed:', error)
    return NextResponse.json({ error: 'Could not update that FAQ entry' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; faqId: string }> }
) {
  try {
    const { slug, faqId } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const existing = await findOwnedFaq(owned.deck.id, faqId)
    if (!existing) {
      return NextResponse.json({ error: 'FAQ entry not found' }, { status: 404 })
    }

    await prisma.deckFaqItem.delete({ where: { id: existing.id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[Publish QA] faq delete failed:', error)
    return NextResponse.json({ error: 'Could not delete that FAQ entry' }, { status: 500 })
  }
}
