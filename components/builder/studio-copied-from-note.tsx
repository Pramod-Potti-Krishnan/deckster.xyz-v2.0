"use client"

import { useEffect, useState } from 'react'
import { copiedFromLine, loadCopiedFrom, type CopiedFrom } from '@/lib/studio-duplicate-deck'

const shellStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere' as const,
  background: 'var(--ss-panel, #ffffff)',
  color: 'var(--ss-muted, #566965)',
  borderColor: 'var(--ss-line, #dde5e2)',
}

export interface StudioCopiedFromLineProps {
  copiedFrom?: CopiedFrom | null
  /** Studio shell: the shell's palette. Otherwise the classic builder's own light/dark classes. */
  studioShell?: boolean
  className?: string
}

/**
 * NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: the ONE line in a copied deck's chat, "Copied from <title>. Chat history stays with the original." Its own small
 * element beside the chat's other notices; it is never a chat message (nothing is added to the transcript, the cache or the history).
 */
export function StudioCopiedFromLine({ copiedFrom, studioShell = false, className = '' }: StudioCopiedFromLineProps) {
  if (!copiedFrom) return null
  return <p data-studio-copied-from-note="true" role="note"
    className={`min-w-0 rounded-md border px-3 py-2 text-xs leading-relaxed ${studioShell ? '' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'} ${className}`}
    style={studioShell ? shellStyle : { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>{copiedFromLine(copiedFrom.title)}</p>
}

/**
 * Reads the session's durable "copied from" marker (GET /api/sessions/{id}, stateCache.currentStatus.copiedFrom, written by the deck list's Duplicate) and shows
 * the line. It is an independent read: it touches none of the Builder's session restore, message cache or socket. A session with no marker, an unsaved one, a
 * failed read: nothing renders. The page mounts it only with the flag on.
 */
export function StudioCopiedFromNote({ sessionId, studioShell = false, className = '' }: { sessionId?: string | null; studioShell?: boolean; className?: string }) {
  const [found, setFound] = useState<{ sessionId: string; copiedFrom: CopiedFrom | null } | null>(null)
  useEffect(() => {
    if (!sessionId || sessionId === 'new') return undefined
    const controller = new AbortController()
    void loadCopiedFrom(sessionId, (input, init) => fetch(input, init), controller.signal).then(copiedFrom => {
      if (!controller.signal.aborted) setFound({ sessionId, copiedFrom })
    })
    return () => controller.abort()
  }, [sessionId])
  // A marker read for another session is never shown for this one.
  return <StudioCopiedFromLine copiedFrom={found && found.sessionId === sessionId ? found.copiedFrom : null} studioShell={studioShell} className={className} />
}
