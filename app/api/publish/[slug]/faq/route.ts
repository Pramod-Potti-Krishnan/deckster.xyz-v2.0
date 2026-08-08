/**
 * GET /api/publish/[slug]/faq — the public FAQ for a published deck.
 *
 * Public, so it runs the same visibility gate as the page itself: a restricted
 * deck's FAQ must not be readable without the passcode, or the FAQ becomes a
 * summary of a deck the caller was never allowed to open.
 *
 * Unlike `/ask`, this route stays available when Q&A is switched off. The FAQ
 * is text the publisher approved and published; turning off the live endpoint
 * stops new questions, it does not retract answers already on the deck.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode'
import { serializeFaqForViewer } from '@/lib/publish/qa-serialize'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const deck = await prisma.publishedDeck.findUnique({
      where: { slug },
      select: {
        id: true,
        visibility: true,
        passcodeHash: true,
        revokedAt: true,
        qaCiteWebSources: true,
        user: { select: { name: true } },
      },
    })
    if (!deck || deck.revokedAt) {
      return NextResponse.json({ error: 'Published deck not found' }, { status: 404 })
    }

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

    const items = await prisma.deckFaqItem.findMany({
      where: { publishedDeckId: deck.id, published: true },
      orderBy: [{ sortOrder: 'asc' }, { approvedAt: 'asc' }],
    })

    const ownerName = deck.user?.name?.trim() || 'the deck owner'
    return NextResponse.json({
      faq: items.map((item) =>
        serializeFaqForViewer(item, {
          slug,
          citeWebSources: deck.qaCiteWebSources,
          ownerName,
        })
      ),
    })
  } catch (error) {
    console.error('[Publish QA] faq read failed:', error)
    return NextResponse.json({ error: 'Could not load the FAQ' }, { status: 500 })
  }
}
