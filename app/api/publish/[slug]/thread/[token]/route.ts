/**
 * GET /api/publish/[slug]/thread/[token] — the asker's own thread.
 *
 * An anonymous asker has no account, so this token is the ONLY way they ever
 * see their answer. It is a bearer capability, which puts three requirements on
 * this route:
 *
 *   - Lookup is by token HASH. The raw token is never stored, so a database
 *     leak grants access to no thread.
 *   - The result must be scoped to this deck as well as the token. Without the
 *     deck clause the token would work on any slug, turning a URL from one deck
 *     into a probe against others.
 *   - The response is `serializeThreadForAsker`, never the row. The row carries
 *     cost, confidence, the gate that fired and the raw citation set naming the
 *     publisher's private documents. None of that is the asker's.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode'
import { hashFollowUpToken } from '@/lib/publish/qa-limits'
import { serializeThreadForAsker } from '@/lib/publish/qa-serialize'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  try {
    const { slug, token } = await params
    if (!token || token.length > 200) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

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

    // Single indexed lookup on the unique hash column, then an equality check
    // on the deck. Same 404 either way — a wrong token and a token for another
    // deck are indistinguishable to the caller.
    const question = await prisma.deckQuestion.findUnique({
      where: { askerTokenHash: hashFollowUpToken(token) },
    })
    if (!question || question.publishedDeckId !== deck.id) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Best effort: the read receipt tells the owner their answer landed. Never
    // worth failing the read for.
    if (!question.askerSeenAt) {
      prisma.deckQuestion
        .update({ where: { id: question.id }, data: { askerSeenAt: new Date() } })
        .catch((error) => console.error('[Publish QA] askerSeenAt update failed:', error))
    }

    const ownerName = deck.user?.name?.trim() || 'the deck owner'
    return NextResponse.json({
      thread: serializeThreadForAsker(question, {
        slug,
        citeWebSources: deck.qaCiteWebSources,
        ownerName,
      }),
    })
  } catch (error) {
    console.error('[Publish QA] thread read failed:', error)
    return NextResponse.json({ error: 'Could not load that thread' }, { status: 500 })
  }
}
