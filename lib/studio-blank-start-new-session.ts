/**
 * J3-BLANK-START-SESSION (ELEMENT-2): after "Deckster was updated · Reload now", Studio showed the brief page for an existing deck, and
 * "Start on a blank canvas" reopened that deck instead of making a new one (the next Add Element landed on it).
 *
 * Flag NEXT_PUBLIC_STUDIO_BLANK_START_NEW_SESSION (exact "true", Studio shell only), default off. Off, nothing here runs: the page hands the
 * first-run row the same dismiss handler as before, and hooks/use-studio-blank-start.ts returns before reading or writing anything.
 *
 * Cause (app/builder/page.tsx):
 *  - "Start on a blank canvas" (the first-run row, and the stage's own "Start on this blank canvas") is handleDismissBlankPlaceholder. It only
 *    hides the landing over the CURRENT session's blank deck; it never makes a session or a deck.
 *  - That dismissal is React state (blankPlaceholderDismissed), false again on every load. A blank-canvas deck keeps activeVersion 'blank'
 *    and has no Director slide structure, so elements added by hand (the table) make it neither "generated" nor "authored" for the canvas
 *    lifecycle (lib/studio-canvas-lifecycle.ts): its landing shows again after any reload. "Reload now" is window.location.reload()
 *    (components/build-version-guard.tsx), which keeps ?session_id=, so the reload reopened that deck behind the brief page, and the
 *    button then revealed it.
 *
 * On:
 *  1. the choice is remembered per account and session (localStorage, the newest BLANK_START_MEMORY_LIMIT sessions) and restored when the
 *     session loads: a reload keeps the user on the deck they started;
 *  2. "Start on a blank canvas" on a session whose blank canvas was already started AND that holds work (it has a saved history row) opens a
 *     NEW session through the Builder's own New flow, then starts that session's blank canvas once its blank deck arrives (the same
 *     dismiss handler, on the new session's own deck). A just-started, still unsaved blank canvas is dismissed exactly as before.
 *
 * Pure policy only: no React, no network. The Next build inlines the flag below.
 */

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_BLANK_START_NEW_SESSION_ENABLED = process.env.NEXT_PUBLIC_STUDIO_BLANK_START_NEW_SESSION === 'true'

/** How many started sessions one account remembers (oldest dropped first). */
export const BLANK_START_MEMORY_LIMIT = 50

export interface BlankStartStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Per-account localStorage key: a JSON array of session ids whose blank canvas the user started, oldest first. */
export function blankStartKey(ownerId: string): string {
  return `deckster:studio-blank-started:v1:${ownerId}`
}

function readStarted(storage: BlankStartStorage | null | undefined, ownerId: string): string[] {
  if (!storage || !ownerId) return []
  try {
    const parsed: unknown = JSON.parse(storage.getItem(blankStartKey(ownerId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
  } catch {
    return []
  }
}

/** Whether the user already started this session's blank canvas (in this browser). */
export function hasBlankStart(storage: BlankStartStorage | null | undefined, ownerId: string, sessionId: string | null): boolean {
  return Boolean(sessionId) && sessionId !== 'new' && readStarted(storage, ownerId).includes(sessionId as string)
}

/** Remember that the user started this session's blank canvas. Storage errors are swallowed (private mode, quota). */
export function rememberBlankStart(storage: BlankStartStorage | null | undefined, ownerId: string, sessionId: string | null): void {
  if (!storage || !ownerId || !sessionId || sessionId === 'new') return
  const started = readStarted(storage, ownerId).filter(id => id !== sessionId)
  started.push(sessionId)
  try {
    storage.setItem(blankStartKey(ownerId), JSON.stringify(started.slice(-BLANK_START_MEMORY_LIMIT)))
  } catch {
    // The canvas still opens; only the reload memory is lost.
  }
}

/**
 * What "Start on a blank canvas" does. Flag off: always 'dismiss' (today's handler). On: 'new_session' only when the current session's
 * blank canvas was already started and the session holds work (a saved row); otherwise 'dismiss'.
 */
export function decideBlankStart(input: {
  enabled: boolean
  sessionId: string | null
  started: boolean
  unsavedSession: boolean
}): 'dismiss' | 'new_session' {
  return input.enabled && Boolean(input.sessionId) && input.started && !input.unsavedSession ? 'new_session' : 'dismiss'
}

/** A pending "start the new session's blank canvas": `from` is the session the click left, `to` the first session after it. */
export interface BlankStartCarry {
  from: string | null
  to: string | null
}

/**
 * One step of the pending start. The first session after `from` becomes `to`; the start fires once `to` owns its deck while its landing
 * shows, and is dropped if the user moves to any other session or the landing is gone (a build started) by the time the deck is owned.
 */
export function advanceBlankStartCarry(
  carry: BlankStartCarry | null,
  now: { sessionId: string | null; hasOwnedSelection: boolean; showLanding: boolean },
): { carry: BlankStartCarry | null; dismiss: boolean } {
  if (!carry) return { carry: null, dismiss: false }
  if (carry.to === null) {
    if (!now.sessionId || now.sessionId === carry.from) return { carry, dismiss: false }
    carry = { from: carry.from, to: now.sessionId }
  }
  if (now.sessionId !== carry.to) return { carry: null, dismiss: false }
  if (!now.hasOwnedSelection) return { carry, dismiss: false }
  return { carry: null, dismiss: now.showLanding }
}
