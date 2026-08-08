/**
 * POST/DELETE /api/publish/[slug]/questions/[id]/block — mute an abusive asker.
 *
 * The block key is the question's `askerIpHash`, scoped to this deck. It is a
 * blunt instrument on purpose: we deliberately hold nothing better to identify
 * an anonymous asker by, and inventing a stronger identifier would mean
 * collecting the PII we chose not to collect.
 *
 * Storage is the `blocked` status itself rather than a separate table — the ask
 * route asks "does this deck have a blocked question from this IP hash?", so
 * one row is the whole mechanism. Unblocking must therefore clear every such
 * row, since any single one re-blocks.
 *
 * The asker is never told. A blocked question is reported to them as an
 * ordinary defer; telling someone they are blocked only teaches them to evade
 * it, and the shared-IP false positive (an office, a VPN) deserves the gentler
 * message anyway.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findOwnedQuestion, requireDeckOwner } from '@/lib/publish/qa-owner'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  return setBlocked(params, true)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  return setBlocked(params, false)
}

async function setBlocked(
  params: Promise<{ slug: string; id: string }>,
  blocked: boolean
) {
  try {
    const { slug, id } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const question = await findOwnedQuestion(owned.deck.id, id)
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    if (blocked) {
      const result = await prisma.deckQuestion.updateMany({
        where: { publishedDeckId: owned.deck.id, askerIpHash: question.askerIpHash },
        data: { status: 'blocked' },
      })
      return NextResponse.json({ blocked: true, questionsAffected: result.count })
    }

    // Unblock: every blocked row for this asker must go, or the ask route's
    // "any blocked row" check keeps them out.
    const result = await prisma.deckQuestion.updateMany({
      where: {
        publishedDeckId: owned.deck.id,
        askerIpHash: question.askerIpHash,
        status: 'blocked',
      },
      // Restored to 'deferred', not to whatever they were before: the previous
      // status was overwritten by the block and is not recoverable. Deferred is
      // the safe landing spot — it puts them back in the owner's inbox.
      data: { status: 'deferred' },
    })
    return NextResponse.json({ blocked: false, questionsAffected: result.count })
  } catch (error) {
    console.error('[Publish QA] block failed:', error)
    return NextResponse.json({ error: 'Could not update the block' }, { status: 500 })
  }
}
