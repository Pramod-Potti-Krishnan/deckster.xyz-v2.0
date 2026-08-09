/**
 * GET/POST /api/publish/[slug]/qa-corpus — corpus status, and rebuild on demand.
 *
 * Publishing and enabling Q&A both build the corpus automatically, so this
 * exists for the cases they do not cover:
 *
 *   - the owner changed the source allowlist and needs the denied content
 *     actually removed (denial is enforced by not copying, which only takes
 *     effect on the next freeze);
 *   - a build failed and they want to try again without a pointless republish.
 *
 * POST is idempotent in effect — a rebuild always supersedes whatever version
 * was there — so a double-click costs embedding, not correctness.
 */

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDeckOwner } from '@/lib/publish/qa-owner'
import { refreshQaCorpus } from '@/lib/publish/qa-corpus'
import { isQaBackendConfigured } from '@/lib/publish/qa'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    return NextResponse.json({
      status: owned.deck.qaCorpusStatus,
      version: owned.deck.qaCorpusVersion,
      // The corpus is stale when it was frozen from an older snapshot than the
      // one currently published — republishing changes the deck viewers see
      // without necessarily rebuilding what the answers are grounded in.
      stale:
        owned.deck.qaCorpusVersion !== null && owned.deck.qaCorpusVersion !== owned.deck.version,
      configured: isQaBackendConfigured(),
    })
  } catch (error) {
    console.error('[Publish QA] corpus status failed:', error)
    return NextResponse.json({ error: 'Could not read corpus status' }, { status: 500 })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const owned = await requireDeckOwner(slug)
    if (owned.error) return owned.error

    if (!isQaBackendConfigured()) {
      return NextResponse.json(
        { error: 'Q&A is not available on this deployment' },
        { status: 503 }
      )
    }
    if (owned.deck.revokedAt) {
      return NextResponse.json(
        { error: 'This deck is unpublished. Republish it first.' },
        { status: 409 }
      )
    }
    if (!owned.deck.qaEnabled) {
      return NextResponse.json(
        { error: 'Turn on questions for this deck first' },
        { status: 400 }
      )
    }

    // Report 'building' immediately so the UI reflects the click, then do the
    // work after the response — a freeze can take tens of seconds and the owner
    // should not be watching a spinner for it.
    await prisma.publishedDeck.update({
      where: { id: owned.deck.id },
      data: { qaCorpusStatus: 'building' },
    })
    after(() => refreshQaCorpus(owned.deck.id))

    return NextResponse.json({ status: 'building' })
  } catch (error) {
    console.error('[Publish QA] corpus rebuild failed:', error)
    return NextResponse.json({ error: 'Could not start the rebuild' }, { status: 500 })
  }
}
