import { useEffect, useState } from 'react'
import { STUDIO_DUPLICATE_COPY_TITLE_ENABLED, installCopyTitles, loadCopyTitle } from '@/lib/studio-duplicate-copy-title'

/**
 * NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE (exact "true", default off, build-time): the Decks page keeps a copy's " (copy)" suffix visible. The deck cards are held byte for byte by other changes'
 * pins, so the page is not edited: <html> gets data-studio-copy-title="true" (the stylesheet is scoped to it) and lib/studio-duplicate-copy-title.ts marks the copy cards with attributes only (it never
 * changes a text node or adds or removes a node, which React would trip over on its next render). Off, the effect returns before it reads the document: nothing is set or observed.
 */
export function useStudioDuplicateCardTitles(): void {
  useEffect(() => {
    if (!STUDIO_DUPLICATE_COPY_TITLE_ENABLED) return
    return installCopyTitles(window)
  }, [])
}

/**
 * NEXT_PUBLIC_STUDIO_DUPLICATE_COPY_TITLE: the Builder header's title for a copied deck. A copy has no slideStructure (so no main_title), and the header said "Studio"; this reads the open
 * session once (GET /api/sessions/{id}, the same independent read the copy's "Copied from" note makes), and returns the session's own title when the session carries the copy marker, else null
 * (a deck that was not copied, an unsaved session, a failed read). `enabled` is false while the header already has a title, so then nothing is read at all. Off, the effect returns before it
 * fetches and the hook is always null. A title read for another session is never returned for this one.
 */
export function useStudioDuplicateCopyTitle(sessionId: string | null | undefined, enabled: boolean): string | null {
  const [found, setFound] = useState<{ sessionId: string; title: string | null } | null>(null)
  useEffect(() => {
    if (!STUDIO_DUPLICATE_COPY_TITLE_ENABLED || !enabled || !sessionId || sessionId === 'new') return undefined
    const controller = new AbortController()
    void loadCopyTitle(sessionId, (input, init) => fetch(input, init), controller.signal).then(title => {
      if (!controller.signal.aborted) setFound({ sessionId, title })
    })
    return () => controller.abort()
  }, [sessionId, enabled])
  return enabled && found && found.sessionId === sessionId ? found.title : null
}

/** The Builder page spreads this over the header's props (a prop spread after another overrides it): { deckTitle } for a copy, nothing for any other deck (and always nothing with the flag off). */
export type StudioCopyTitleHeaderProps = { deckTitle?: string }
const NO_HEADER_PROPS: StudioCopyTitleHeaderProps = {}
export function useStudioDuplicateCopyTitleProps(sessionId: string | null | undefined, enabled: boolean): StudioCopyTitleHeaderProps {
  const title = useStudioDuplicateCopyTitle(sessionId, enabled)
  return title ? { deckTitle: title } : NO_HEADER_PROPS
}
