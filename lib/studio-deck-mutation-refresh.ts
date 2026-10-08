// S-03 (frontend): consume Director's `deck_mutation` frame (flag NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED,
// exact "true", default off). Import-free so scripts/test-studio-deck-mutation-refresh.mjs can run it under plain node.
//
// The hook (hooks/use-deckster-websocket-v2.ts) already validates the frame, checks it belongs to this socket's
// session and to the deck the hook holds, and de-duplicates by message_id. This module decides what the builder does
// with it: only for the DISPLAYED deck and only while the owner is current, bump the viewer's refreshToken (so the
// iframe reloads) and ask the slide rail to re-read Layout's inventory (PR #317's controller).

export const STUDIO_DECK_MUTATION_REFRESH_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED === 'true'

export type DeckMutationKindInput = 'slide_added' | 'slide_deleted' | 'slide_replaced' | 'slide_reordered'

export interface DeckMutationFrameInput {
  message_id: string
  payload: {
    mutation: DeckMutationKindInput | string
    slide_index: number
    new_slide_index?: number | null
    presentation_id: string
    presentation_url?: string | null
    refresh_token: string
  }
}

export interface DisplayedDeckInput {
  presentationId: string | null
  presentationUrl: string | null
  slideCount: number | null
  refreshToken: number
}

export interface DeckMutationRefreshPlan {
  /** The viewer override the builder commits: same shape as its slideComposerOverride state. */
  override: { presentationUrl: string | null; presentationId: string; slideCount: number | null; refreshToken: number }
  /** Slide (0-based) the mutation points at, for a caller that wants to navigate; informational only. */
  focusSlideIndex: number | null
}

const KINDS = new Set(['slide_added', 'slide_deleted', 'slide_replaced', 'slide_reordered'])

/** Bounded per-builder memory of handled frames, so a re-delivered frame never fires twice. */
export function createDeckMutationSeen(limit = 500): { has(key: string): boolean; add(key: string): void } {
  const keys = new Set<string>()
  return {
    has: key => keys.has(key),
    add(key) {
      keys.add(key)
      if (keys.size > limit) {
        const oldest = keys.values().next().value
        if (oldest !== undefined) keys.delete(oldest)
      }
    },
  }
}

/** null = ignore the frame (another deck, a stale owner, a duplicate, or a malformed frame). */
export function planDeckMutationRefresh(input: {
  message: DeckMutationFrameInput | null | undefined
  ownerIsCurrent: boolean
  ownerPresentationId: string | null | undefined
  displayed: DisplayedDeckInput
  now: number
  seen?: { has(key: string): boolean; add(key: string): void }
}): DeckMutationRefreshPlan | null {
  const { message, displayed } = input
  if (!input.ownerIsCurrent || !message || typeof message !== 'object') return null
  const payload = message.payload
  if (!payload || typeof payload !== 'object' || !KINDS.has(payload.mutation)) return null
  if (typeof message.message_id !== 'string' || !message.message_id) return null
  const presentationId = payload.presentation_id
  if (typeof presentationId !== 'string' || !presentationId) return null
  if (presentationId !== displayed.presentationId || input.ownerPresentationId !== presentationId) return null
  const key = JSON.stringify([presentationId, message.message_id])
  if (input.seen) {
    if (input.seen.has(key)) return null
    input.seen.add(key)
  }
  const count = displayed.slideCount
  const slideCount = typeof count !== 'number' || !Number.isFinite(count) ? null
    : payload.mutation === 'slide_added' ? count + 1
      : payload.mutation === 'slide_deleted' ? Math.max(0, count - 1)
        : count
  const target = payload.mutation === 'slide_reordered' && Number.isInteger(payload.new_slide_index)
    ? payload.new_slide_index as number : payload.slide_index
  const focusSlideIndex = payload.mutation === 'slide_deleted' || !Number.isInteger(target) || (target as number) < 0
    ? null : target as number
  return {
    override: {
      // The hook only forwards an allowed /p/{presentation_id} URL; otherwise keep the one on screen.
      presentationUrl: typeof payload.presentation_url === 'string' && payload.presentation_url
        ? payload.presentation_url : displayed.presentationUrl,
      presentationId,
      slideCount,
      refreshToken: Math.max(input.now, (Number.isFinite(displayed.refreshToken) ? displayed.refreshToken : 0) + 1),
    },
    focusSlideIndex,
  }
}

// Rail re-read requests: the builder asks, the rail hook (hooks/use-slide-rail-identity.ts) listens
// only while this flag is on. Keyed by presentation id so another deck's rail ignores it.
type RailRefreshListener = (presentationId: string) => void
const railRefreshListeners = new Set<RailRefreshListener>()

export function onSlideRailRefreshRequest(listener: RailRefreshListener): () => void {
  railRefreshListeners.add(listener)
  return () => { railRefreshListeners.delete(listener) }
}

export function requestSlideRailRefresh(presentationId: string): number {
  let delivered = 0
  for (const listener of Array.from(railRefreshListeners)) {
    try { listener(presentationId); delivered++ } catch { /* a listener never breaks the frame path */ }
  }
  return delivered
}
