// FRONTEND-1, overnight chat parity (11 Nov): the browser deps of "Duplicate a deck", in one place. They are the object the Decks page built inline (app/(app)/dashboard/page.tsx duplicateSession), moved here
// unchanged so the Builder's /duplicate-deck (lib/studio-chat-parity-nav.ts, behind NEXT_PUBLIC_STUDIO_CHAT_COMMANDS and NEXT_PUBLIC_STUDIO_DUPLICATE_DECK) copies a deck the same way the Decks page does.
// The Decks page calls studioDuplicateDeckDeps() where it had the object; nothing about what it sends, in what order, or what it shows has changed.
import { LAYOUT_VIEWER_URL_POLICY, getLayoutServiceUrl } from '@/lib/layout-service-client'
import { evaluateLayoutViewerUrl } from '@/lib/layout-viewer-url-policy'
import { duplicateTargetFor, runDuplicateDeck, type DuplicateDeckDeps } from '@/lib/studio-duplicate-deck'

/** The deps runDuplicateDeck takes: the browser's fetch, Layout's base URL, a fresh uuid, the clock, a sleep. */
export const studioDuplicateDeckDeps = (): DuplicateDeckDeps => ({
  fetch: (input, init) => fetch(input, init),
  layoutBaseUrl: () => getLayoutServiceUrl(),
  newId: () => crypto.randomUUID(),
  now: () => new Date(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
})

/** The part of a saved session (GET /api/sessions/{id}) a copy reads. */
export interface DuplicateSessionRow { id: string; title?: string | null; currentStage?: number | null; slideCount?: number | null; finalPresentationUrl?: string | null; strawmanPreviewUrl?: string | null }

/** Copy the deck a saved session stands for, as the Decks page's Duplicate does (the same target rule, the same three steps), and answer a title or a plain message. The copy is never opened here. */
export async function duplicateSessionDeck(row: DuplicateSessionRow): Promise<{ ok: true; title: string } | { ok: false; message: string }> {
  const shownTitle = (typeof row.title === 'string' && row.title.trim()) || 'Untitled Presentation'
  const target = duplicateTargetFor(row, url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY))
  if (!target.ok) return { ok: false, message: target.reason }
  try {
    const result = await runDuplicateDeck({ source: { sessionId: row.id, shownTitle, currentStage: row.currentStage, slideCount: row.slideCount }, target, deps: studioDuplicateDeckDeps() })
    return result.ok ? { ok: true, title: result.title } : { ok: false, message: result.message }
  } catch {
    return { ok: false, message: 'The deck could not be copied. Nothing was created.' }
  }
}
