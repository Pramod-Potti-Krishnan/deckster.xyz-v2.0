'use client'

// PASS2D A1 (flag NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT, default off): the React side of lib/studio-composer-draft.ts. With `enabled` false it only
// declares hooks and does nothing: no storage access, no state change.
import { useEffect, useRef } from 'react'
import {
  composerDraftKey,
  planComposerDraftRestore,
  readComposerDraft,
  writeComposerDraft,
  type ComposerDraftStorage,
} from '@/lib/studio-composer-draft'

export interface UseStudioComposerDraftOptions {
  enabled: boolean
  /** The account the builder is keyed to (the draft is never shown to another account). */
  owner: string | null | undefined
  /** The builder's current session id; null or 'new' while a fresh session has no id yet (nothing is kept until it has one). */
  sessionId: string | null | undefined
  /** The composer text (the page's `inputMessage`) and its setter. */
  value: string
  setValue: (next: string) => void
}

function sessionStorageOrNull(): ComposerDraftStorage | null {
  try { return window.sessionStorage } catch { return null }
}

export function useStudioComposerDraft({ enabled, owner, sessionId, value, setValue }: UseStudioComposerDraftOptions): void {
  const key = enabled ? composerDraftKey(owner, sessionId) : null
  const valueRef = useRef(value)
  valueRef.current = value
  const setValueRef = useRef(setValue)
  setValueRef.current = setValue
  // The scope the last restore ran for, and the scope whose first write is skipped (see the write effect).
  const restoredKeyRef = useRef<string | null>(null)
  const skipWriteKeyRef = useRef<string | null>(null)

  // Restore. Declared before the write effect: both run in the commit where the scope changes, and the write must not save the old
  // scope's text (or the empty box a reload starts with) over the draft this effect is about to put back.
  useEffect(() => {
    const previous = restoredKeyRef.current
    restoredKeyRef.current = key
    if (!key) return
    const plan = planComposerDraftRestore(previous, key, valueRef.current, readComposerDraft(sessionStorageOrNull(), key))
    if (plan.set) {
      // The box is about to change; the write for THIS commit would save the old text (or the empty box a reload starts with) over it.
      skipWriteKeyRef.current = key
      setValueRef.current(plan.text)
    }
  }, [key])

  // Write: keep the box's text under the scope, blank removes it. Text the restore kept (a fresh session's id arriving after you typed) is
  // written at once; only a commit whose restore replaced the box skips, and the render that follows writes the restored text.
  useEffect(() => {
    if (!key) return
    if (skipWriteKeyRef.current === key) { skipWriteKeyRef.current = null; return }
    writeComposerDraft(sessionStorageOrNull(), key, value)
  }, [key, value])
}
