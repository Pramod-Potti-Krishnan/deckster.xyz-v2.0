// PASS2D A1 (flag NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT, exact "true"; default off): the unsent text in the chat composer survives a reload.
//
// What went wrong (PASS2-J1-FINDINGS item 4, J1 run S4): the composer text is React state only (app/builder/page.tsx `inputMessage`),
// so a reload, a re-opened tab or a crash drops anything typed but not yet sent. The J1 run typed a draft into an empty session,
// reloaded, and got the greeting back with an empty box.
//
// Behaviour with the flag on:
//   1. The text is kept in sessionStorage per account + session (the same scope as the builder's other per-session options), written as you
//      type. Blank text removes the key, so a sent, cleared or emptied composer leaves nothing behind.
//   2. On load (or when the session id is first assigned to a fresh session) the stored draft goes back into an EMPTY box. Text already
//      in the box wins: it is never replaced by an older draft.
//   3. Moving to another existing session shows that session's own draft (or an empty box); the old one stays stored under its session.
//   4. A completed send clears the box (the page's existing clearSubmittedComposer), which removes the stored draft; a failed send leaves
//      the text in the box, so it stays stored too.
// Everything is best effort: a blocked or full storage never throws and the composer works exactly as before.
//
// This file imports nothing, so a node test can load it on its own.

// Literal property access so Next inlines the value into the client bundle.
export const STUDIO_COMPOSER_DRAFT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT === 'true'

// A draft is a few paragraphs, not a document; the cap keeps a pasted wall of text from filling the session's storage.
export const COMPOSER_DRAFT_MAX_CHARS = 20_000

export interface ComposerDraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** The storage key for one account + session, or null where a draft cannot be kept (signed out, or a session with no id yet). */
export function composerDraftKey(owner: string | null | undefined, sessionId: string | null | undefined): string | null {
  if (!owner || !sessionId || sessionId === 'new') return null
  return `deckster_composer_draft_v1_${encodeURIComponent(owner)}_${sessionId}`
}

/** The stored draft, or '' when there is none, it is blank, or the storage cannot be read. */
export function readComposerDraft(storage: ComposerDraftStorage | null, key: string | null): string {
  if (!storage || !key) return ''
  try {
    const raw = storage.getItem(key)
    return typeof raw === 'string' && raw.trim() ? raw.slice(0, COMPOSER_DRAFT_MAX_CHARS) : ''
  } catch {
    return ''
  }
}

/** Keep `text` as the draft; blank text removes it. Never throws. */
export function writeComposerDraft(storage: ComposerDraftStorage | null, key: string | null, text: string): void {
  if (!storage || !key) return
  try {
    if (!text.trim()) storage.removeItem(key)
    else storage.setItem(key, text.slice(0, COMPOSER_DRAFT_MAX_CHARS))
  } catch {
    // Private mode or a full storage: the composer still works, it just does not remember.
  }
}

export type ComposerDraftRestore = { set: false } | { set: true; text: string }

/**
 * What the box should do when the draft scope changes to `scope`.
 *  - `previousScope` is the scope before this change (null when there was none: a fresh page, or a session with no id yet).
 *  - `current` is what the box holds now; `stored` is the draft kept for `scope` ('' when none).
 * From another session: the box shows `scope`'s own draft (possibly ''), so one session's text never lands in another.
 * Otherwise (load, or the id of a fresh session arriving): an empty box takes the stored draft, a box with text keeps it.
 */
export function planComposerDraftRestore(previousScope: string | null, scope: string, current: string, stored: string): ComposerDraftRestore {
  if (previousScope !== null && previousScope !== scope) return current === stored ? { set: false } : { set: true, text: stored }
  if (!current.trim() && stored) return { set: true, text: stored }
  return { set: false }
}
