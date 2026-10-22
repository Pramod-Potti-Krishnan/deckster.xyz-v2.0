// FRONTEND-2 (flag NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE, exact "true", default off, read at build time). Import-free so
// scripts/test-studio-deck-mutation-dedupe.mjs can run it under plain node.
//
// The bug (Decision B preview, chat flags and NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED on): a chat add-slide sends
// `slide_ready` and then `deck_mutation{slide_added}` for the same slide. slide_ready's reconcile already sets the builder's
// displayed count from Layout (5 -> 6); the deck_mutation plan (lib/studio-deck-mutation-refresh.ts) then adds one to that
// count (6 -> 7) under a new refresh token. The viewer adopts the prop exactly on the refreshed URL and its poll only ever
// raises it, so the rail header and the footer say 7 while the rail list (Layout's slide inventory) and the canvas (the
// Layout iframe) say 6. The deck_mutation frame carries no slide id and no job id, so it cannot be matched to the slide_ready.
//
// With the flag on, the count committed for a deck_mutation is the one Layout's slide inventory reports (the same read the
// rail list uses), so add, delete, replace and reorder all land on Layout's number whatever arrived before. Only when Layout
// cannot answer in time does the plan's own count stand (today's behaviour). Commits run one at a time, in frame order.

export const STUDIO_DECK_MUTATION_DEDUPE_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE === 'true'

/** Same shape as DeckMutationRefreshPlan['override'] in lib/studio-deck-mutation-refresh.ts. */
export interface DeckMutationOverrideInput {
  presentationUrl: string | null
  presentationId: string
  slideCount: number | null
  refreshToken: number
}

export interface DeckMutationCountSettlerDeps {
  /** Layout's slide count for this deck (its slide inventory), or null when Layout cannot answer. */
  readLayoutCount: (presentationId: string) => Promise<number | null>
  /** The builder's displayed deck at commit time (slideComposerPresentationRef.current). */
  getDisplayed: () => { presentationId: string | null; refreshToken: number }
  /** Commits the override the way the flag-off handler does (ref, override state, rail re-read, deck-changed notice). */
  commit: (override: DeckMutationOverrideInput) => void
  /** A Layout read that has not answered by then counts as "cannot answer". */
  timeoutMs?: number
  setTimer?: (callback: () => void, ms: number) => unknown
}

export const DECK_MUTATION_LAYOUT_COUNT_TIMEOUT_MS = 4000

function isLayoutCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/**
 * Returns settle(override, ownerIsCurrent): reads Layout's count for override.presentationId, then commits the override with
 * that count, unless the owner retired or another deck is displayed meanwhile. The refresh token never goes backwards.
 */
export function createDeckMutationCountSettler(deps: DeckMutationCountSettlerDeps) {
  const timeoutMs = deps.timeoutMs ?? DECK_MUTATION_LAYOUT_COUNT_TIMEOUT_MS
  const setTimer = deps.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms))
  let queue: Promise<void> = Promise.resolve()

  const readLayoutCount = (presentationId: string) => new Promise<number | null>(resolve => {
    let settled = false
    const finish = (value: unknown) => {
      if (settled) return
      settled = true
      resolve(isLayoutCount(value) ? value : null)
    }
    setTimer(() => finish(null), timeoutMs)
    Promise.resolve().then(() => deps.readLayoutCount(presentationId)).then(finish, () => finish(null))
  })

  return function settle(override: DeckMutationOverrideInput, ownerIsCurrent: () => boolean): Promise<void> {
    const run = async () => {
      const layoutCount = await readLayoutCount(override.presentationId)
      if (!ownerIsCurrent()) return
      const displayed = deps.getDisplayed()
      if (!displayed || displayed.presentationId !== override.presentationId) return
      const displayedToken = Number.isFinite(displayed.refreshToken) ? displayed.refreshToken : 0
      deps.commit({
        ...override,
        slideCount: layoutCount ?? override.slideCount,
        refreshToken: Math.max(override.refreshToken, displayedToken + 1),
      })
    }
    queue = queue.catch(() => undefined).then(run)
    return queue
  }
}
