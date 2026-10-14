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
 *     session loads: a reload keeps the user on the deck they started. Stored: session ids only, under one key per account whose name
 *     carries a hash of the account id (never an email). An entry is dropped once its session has a real (generated or authored) deck,
 *     and when the session is deleted from this browser (hooks/use-chat-sessions.ts deleteSession). Every storage access is guarded;
 *     nothing here makes a request or creates a session row;
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
  removeItem?(key: string): void
  readonly length?: number
  key?(index: number): string | null
}

const KEY_PREFIX = 'deckster:studio-blank-started:v1:'

/** FNV-1a (32-bit), hex: the account id never appears in the key name in clear (it may be an email when the user has no id). */
function accountTag(ownerId: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < ownerId.length; i++) {
    hash ^= ownerId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** Per-account localStorage key: a JSON array of session ids whose blank canvas the user started, oldest first. */
export function blankStartKey(ownerId: string): string {
  return `${KEY_PREFIX}${accountTag(ownerId)}`
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
  writeStarted(storage, blankStartKey(ownerId), started.slice(-BLANK_START_MEMORY_LIMIT))
}

function writeStarted(storage: BlankStartStorage, key: string, started: string[]): void {
  try {
    if (started.length === 0 && storage.removeItem) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(started))
  } catch {
    // Private mode or quota: the memory is only lost, nothing else depends on it.
  }
}

/** Forget one session for one account (its deck became a real deck). */
export function forgetBlankStart(storage: BlankStartStorage | null | undefined, ownerId: string, sessionId: string | null): void {
  if (!storage || !ownerId || !sessionId) return
  const started = readStarted(storage, ownerId)
  if (started.includes(sessionId)) writeStarted(storage, blankStartKey(ownerId), started.filter(id => id !== sessionId))
}

/** Forget a deleted session for every account remembered in this browser (the delete path does not know the account). */
export function forgetBlankStartEverywhere(storage: BlankStartStorage | null | undefined, sessionId: string | null): void {
  if (!storage || !sessionId) return
  try {
    const keys: string[] = []
    for (let i = 0; i < (storage.length ?? 0); i++) {
      const key = storage.key?.(i)
      if (key && key.startsWith(KEY_PREFIX)) keys.push(key)
    }
    for (const key of keys) {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]')
      if (!Array.isArray(parsed) || !parsed.includes(sessionId)) continue
      writeStarted(storage, key, parsed.filter((id): id is string => typeof id === 'string' && id.length > 0 && id !== sessionId))
    }
  } catch {
    // Nothing to clean, or storage unavailable.
  }
}

/** The browser's localStorage, or null when it cannot be reached (server render, blocked storage). */
export function browserBlankStartStorage(): BlankStartStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
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
