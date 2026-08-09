/**
 * Building and tearing down a published deck's Q&A corpus.
 *
 * Two rules govern everything here.
 *
 * **It freezes the SNAPSHOT, never the source deck.** Viewers see the snapshot;
 * the owner keeps editing the source. Grounding answers in the source would let
 * the deck answer questions about slides the audience cannot see, and cite
 * slide numbers that no longer line up with what is on their screen.
 *
 * **It can fail without failing anything else.** Publishing is the user's
 * action; the corpus is a derived convenience. A freeze that throws must never
 * take a publish, a settings change or an unpublish down with it, so every
 * entry point here resolves rather than rejects.
 */

import { prisma } from '@/lib/prisma'
import { getPresentationJson } from '@/lib/publish/layout'
import { deleteQaCorpus, freezeQaCorpus, isQaBackendConfigured } from '@/lib/publish/qa'

/** 'none' | 'building' | 'ready' | 'partial' | 'failed' */
export type CorpusStatus = 'none' | 'building' | 'ready' | 'partial' | 'failed'

export function isCorpusUsable(status: string): boolean {
  return status === 'ready' || status === 'partial'
}

/**
 * Rebuild the corpus for a published deck.
 *
 * Never throws and never returns a rejected promise — callers run it from
 * `after()`, where an unhandled rejection is an unhandled rejection in a
 * background task nobody is watching.
 */
export async function refreshQaCorpus(deckId: string): Promise<CorpusStatus> {
  try {
    if (!isQaBackendConfigured()) return 'none'

    const deck = await prisma.publishedDeck.findUnique({
      where: { id: deckId },
      select: {
        id: true,
        snapshotPresentationId: true,
        researcherSessionId: true,
        sessionId: true,
        version: true,
        revokedAt: true,
        qaEnabled: true,
      },
    })
    // A deck unpublished while the build was queued must not get a corpus: the
    // owner has revoked it, and building one now would resurrect answerable
    // content for a link they just switched off.
    if (!deck || deck.revokedAt || !deck.qaEnabled) return 'none'

    await setStatus(deckId, 'building')

    const presentation = await getPresentationJson(deck.snapshotPresentationId)
    if (!presentation) {
      console.error('[Publish QA] snapshot JSON unavailable for freeze:', deckId)
      await setStatus(deckId, 'failed')
      return 'failed'
    }

    // The publisher's denials travel IN on the freeze. Researcher never reads
    // this table — enforcement is that the denied source is not copied, so the
    // bytes are absent rather than filtered at query time.
    const denied = await prisma.publishedDeckSource.findMany({
      where: { publishedDeckId: deckId, allowedForQa: false },
      select: { sourceRef: true },
    })

    const result = await freezeQaCorpus({
      qaCorpusId: deck.id,
      // `version` is already monotonic per deck (every lifecycle write bumps it
      // under a CAS), so a slow freeze racing a fast republish loses: Researcher
      // supersedes any corpus version below the newest one written.
      corpusVersion: deck.version,
      presentation,
      sessionId: deck.researcherSessionId || deck.sessionId,
      excludedSourceRefs: denied.map((row) => row.sourceRef),
    })

    const status: CorpusStatus =
      result?.status === 'ready' ? 'ready' : result?.status === 'partial' ? 'partial' : 'failed'

    await prisma.publishedDeck.update({
      where: { id: deckId },
      data: { qaCorpusStatus: status, qaCorpusVersion: deck.version },
    })
    return status
  } catch (error) {
    console.error('[Publish QA] corpus refresh failed:', deckId, error)
    await setStatus(deckId, 'failed').catch(() => {})
    return 'failed'
  }
}

/**
 * Tear down the corpus for a deck being unpublished.
 *
 * Unpublish is the owner's revocation path and it has to work, so this is
 * best-effort: a Researcher that is down must not block a revoke. The corpus is
 * unreachable either way once `revokedAt` is set, because `/ask` refuses a
 * revoked deck before it looks at anything else — so a leaked corpus row is
 * wasted storage, not an exposure.
 */
export async function teardownQaCorpus(deckId: string): Promise<void> {
  try {
    if (!isQaBackendConfigured()) return
    await deleteQaCorpus(deckId)
    await prisma.publishedDeck
      .update({
        where: { id: deckId },
        data: { qaCorpusStatus: 'none', qaCorpusVersion: null },
      })
      .catch(() => {})
  } catch (error) {
    console.error('[Publish QA] corpus teardown failed:', deckId, error)
  }
}

async function setStatus(deckId: string, status: CorpusStatus): Promise<void> {
  await prisma.publishedDeck.update({
    where: { id: deckId },
    data: { qaCorpusStatus: status },
  })
}
