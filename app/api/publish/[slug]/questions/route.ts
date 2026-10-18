/**
 * GET /api/publish/[slug]/questions — the owner's inbox.
 *
 * Every question asked on the deck, newest first, including the ones the
 * machine refused to answer. The refusals are the point: a defer is only worth
 * anything if it reliably reaches a human who can answer it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDeckOwner } from '@/lib/publish/qa-owner'
import { serializeQuestionForOwner } from '@/lib/publish/qa-serialize'
import { STUDIO_P2_PUBLISH_INBOX_ENABLED } from '@/lib/studio-p2-publish'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
const VALID_STATUSES = ['answered', 'deferred', 'owner_answered', 'blocked']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const cursor = url.searchParams.get('cursor')

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const where = {
      publishedDeckId: owned.deck.id,
      ...(status ? { status } : {}),
    }

    const rows = await prisma.deckQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // Over-fetch by one to learn whether another page exists without a
      // second count query.
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      // NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX: also read the FAQ entry each question was published as, so the inbox can offer Remove from FAQ.
      ...(STUDIO_P2_PUBLISH_INBOX_ENABLED ? { include: { faq: { select: { id: true, published: true } } } } : {}),
    })

    const hasMore = rows.length > PAGE_SIZE
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

    // Unanswered count is over ALL questions, not the current page or filter —
    // it drives the inbox badge, which must not change when the owner filters.
    const unansweredCount = await prisma.deckQuestion.count({
      where: { publishedDeckId: owned.deck.id, ownerAnswer: null, status: { not: 'blocked' } },
    })

    return NextResponse.json({
      questions: STUDIO_P2_PUBLISH_INBOX_ENABLED
        ? page.map((row) => {
            const faq = (row as { faq?: { id: string; published: boolean } | null }).faq
            return { ...serializeQuestionForOwner(row), faqItemId: faq && faq.published ? faq.id : null }
          })
        : page.map(serializeQuestionForOwner),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      unansweredCount,
      qaEnabled: owned.deck.qaEnabled,
      corpusStatus: owned.deck.qaCorpusStatus,
    })
  } catch (error) {
    console.error('[Publish QA] inbox failed:', error)
    return NextResponse.json({ error: 'Could not load questions' }, { status: 500 })
  }
}
