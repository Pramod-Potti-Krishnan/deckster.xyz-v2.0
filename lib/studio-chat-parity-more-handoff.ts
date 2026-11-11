/**
 * FRONTEND-1, overnight chat parity (11 Nov), the REMAINING commands: the hand-off from the chat to a page it opens.
 * Gated by NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (which already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN). No new flag, no backend, no Director change.
 *
 * /delete-theme, /delete-template, /kg-search and /ask leave the Builder for a page that already does the work (Themes, Templates, Knowledge). What the person typed is not put in the address (a URL is logged and
 * stays in history); it is written once, to this browser's local storage, for ONE page to take: the take removes it (the page that took it keeps it a few seconds for its own remounts), and an entry older than two minutes is dropped. Local storage (not a module variable) so a page
 * opened in a NEW TAB (a build is running, or edits are unsaved) gets it too. The page then does what its own control does: the Knowledge search runs its own search, the Ask box is only FILLED (never submitted),
 * the Themes and Templates pages open the row's own delete confirmation (a click there deletes; nothing here ever does).
 *
 * Pure: the storage and the clock come in, so the proof runs it on a fake. The one browser wrapper (takeBrowserHandoff) answers null with the flag off.
 */

export const MORE_HANDOFF_KEY = 'deckster.chatParityMore.handoff.v1'
/** How long an entry waits for its page (ms). */
export const MORE_HANDOFF_TTL_MS = 120_000
export type MoreHandoffKind = 'kg-search' | 'kg-ask' | 'delete-theme' | 'delete-template'
const KINDS: readonly MoreHandoffKind[] = Object.freeze(['kg-search', 'kg-ask', 'delete-theme', 'delete-template'] as MoreHandoffKind[])
export interface MoreHandoffRequest { kind: MoreHandoffKind; /** What was typed (a search, a question) or the item's name (a delete). */ text: string; /** The item's id (a delete); null otherwise. */ id: string | null }
export interface MoreHandoffStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

/** Write the entry. False when the storage is missing or refuses (a private window): the command then says so and goes nowhere. */
export function putHandoff(store: MoreHandoffStore | null, request: MoreHandoffRequest, now: number): boolean {
  if (!store || !KINDS.includes(request.kind) || typeof request.text !== 'string') return false
  try {
    store.setItem(MORE_HANDOFF_KEY, JSON.stringify({ kind: request.kind, text: request.text, id: request.id, at: now }))
    return true
  } catch { return false }
}

/** Take the entry for `kind` (and remove it), or null: none, another kind's (it stays for its own page), or too old (removed). */
export function takeHandoff(store: MoreHandoffStore | null, kind: MoreHandoffKind, now: number): { text: string; id: string | null } | null {
  if (!store) return null
  try {
    const raw = store.getItem(MORE_HANDOFF_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as Partial<MoreHandoffRequest> & { at?: unknown }
    const fresh = typeof entry.at === 'number' && now - entry.at >= 0 && now - entry.at <= MORE_HANDOFF_TTL_MS
    if (!fresh || typeof entry.text !== 'string' || !KINDS.includes(entry.kind as MoreHandoffKind)) { store.removeItem(MORE_HANDOFF_KEY); return null }
    if (entry.kind !== kind) return null
    store.removeItem(MORE_HANDOFF_KEY)
    return { text: entry.text, id: typeof entry.id === 'string' ? entry.id : null }
  } catch { return null }
}

const CHAT_PARITY_MORE_ON = process.env.NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === 'true' && process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true'
const browserStore = (): MoreHandoffStore | null => { try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null } }

/**
 * How long a page that took an entry keeps it for ITS OWN remounts (ms). A page that mounts before its account is known is mounted again once it is (the Knowledge page is keyed by the account), and the first mount's state is gone:
 * a tab opened cold took the entry on the first mount and the second mount found nothing. The taken entry is held here, in this page's memory only (a reload starts empty, and the storage entry is already gone), for a few seconds.
 */
export const MORE_HANDOFF_HOLD_MS = 15_000
const held = new Map<MoreHandoffKind, { value: { text: string; id: string | null }; at: number }>()

/** The page's take. With the flag off: null, nothing read, nothing removed. A remount of the same page within the hold gets the same entry again (the storage entry is gone after the first take). */
export function takeBrowserHandoff(kind: MoreHandoffKind): { text: string; id: string | null } | null {
  if (!CHAT_PARITY_MORE_ON) return null
  const now = Date.now()
  const kept = held.get(kind)
  if (kept && now - kept.at >= 0 && now - kept.at <= MORE_HANDOFF_HOLD_MS) return kept.value
  const taken = takeHandoff(browserStore(), kind, now)
  if (taken) held.set(kind, { value: taken, at: now }); else held.delete(kind)
  return taken
}

/** The composer's put. */
export const putBrowserHandoff = (request: MoreHandoffRequest): boolean => putHandoff(browserStore(), request, Date.now())
