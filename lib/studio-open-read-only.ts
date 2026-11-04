// PASS2D R6 (flag NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY, default off). Standalone and import-free: pure decisions only, no React, no clock, no network.
//
// Opening a saved session in the Builder wrote to it by itself: Director answers a reconnect with a sync, and for a session with no topic yet a fresh greeting (or, at the
// outline step, the plan-confirmation card again), each with a new message id and the time of the reconnect. The Builder saved every one of those (POST .../messages sets the row's
// lastMessageAt to the newest message's time), echoed the state it had just restored back to the row (PATCH with lastMessageAt = now), and a one-slide-short Layout count
// reconcile did the same. So a session that was only looked at jumped to the top of Sessions, and its history grew by one greeting card per open.
//
// This module is the open-time gate. A session that was OPENED (its row was read from history) starts quiet and stays quiet until the user does something:
//   - a metadata write from Director's state frames or the Layout count reconcile ("passive") loses lastMessageAt, loses every field that is only the stored value again or
//     carries no value (null / undefined), and is not sent at all when nothing is left; what is left (a real change) is sent, without lastMessageAt;
//   - a bot message that arrives while quiet ("passive") is held, not sent, unless the row already has that message id;
//   - the first user action (a message with the user's text, or any metadata write that is not passive: Add Slide, a theme or template pick, a hand-off) ends the quiet period
//     for good and sends what was held, in order, before it. Everything after that is exactly as before.
// Held messages of a session that is left without an action are dropped: they were re-sends of what Director says on every reconnect. Nothing here touches a session that was
// not opened (a new one), and nothing about what the page shows.

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_SESSION_OPEN_READ_ONLY_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY === 'true'

/** The row fields a passive metadata write is compared with. */
export const OPEN_QUIET_ROW_KEYS = [
  'title', 'currentStage', 'slideCount',
  'blankPresentationUrl', 'blankPresentationId', 'strawmanPreviewUrl', 'strawmanPresentationId', 'finalPresentationUrl', 'finalPresentationId',
] as const

/** The most messages held while quiet; the oldest are dropped past it (a long passive wait must not grow without bound). */
export const OPEN_QUIET_HELD_LIMIT = 200

export interface OpenQuietHeld { message: unknown; userText?: string }

export interface OpenQuiet {
  sessionId: string
  quiet: boolean
  stored: Record<string, unknown>
  storedStateCache: { activeVersion: string | null; slideStructure: string }
  storedMessageIds: Set<string>
  held: OpenQuietHeld[]
}

function readStateCache(row: any): { activeVersion: string | null; slideStructure: string } {
  const cache = row && typeof row === 'object' ? row.stateCache : null
  return {
    activeVersion: cache && typeof cache.activeVersion === 'string' ? cache.activeVersion : null,
    slideStructure: JSON.stringify(cache && cache.slideStructure !== undefined ? cache.slideStructure : null) ?? 'null',
  }
}

/** Starts the quiet period for a session whose row (as the history returned it) has just been opened. */
export function beginOpenQuiet(sessionId: string, row: any): OpenQuiet {
  const stored: Record<string, unknown> = {}
  if (row && typeof row === 'object') for (const key of OPEN_QUIET_ROW_KEYS) if (row[key] !== undefined && row[key] !== null) stored[key] = row[key]
  const ids = new Set<string>()
  if (row && Array.isArray(row.messages)) for (const message of row.messages) if (message && typeof message.id === 'string') ids.add(message.id)
  return { sessionId, quiet: true, stored, storedStateCache: readStateCache(row), storedMessageIds: ids, held: [] }
}

/** True while `sessionId` is the opened session and nothing has ended its quiet period. */
export function isOpenQuiet(state: OpenQuiet | null | undefined, sessionId: string | null | undefined): boolean {
  return !!state && state.quiet === true && typeof sessionId === 'string' && sessionId !== '' && state.sessionId === sessionId
}

/**
 * What a PASSIVE metadata write may send while quiet: its fields minus lastMessageAt, minus null / undefined, minus every field equal to the stored one; a stateCache is
 * dropped when it is the stored one (same activeVersion and the same slide structure). Returns null when nothing is left.
 */
export function openQuietMetadata(state: OpenQuiet, updates: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!updates || typeof updates !== 'object') return null
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(updates)) {
    if (key === 'lastMessageAt') continue
    const value = updates[key]
    if (value === undefined || value === null) continue
    if (key === 'stateCache') {
      const next = readStateCache({ stateCache: value })
      if (next.activeVersion !== state.storedStateCache.activeVersion || next.slideStructure !== state.storedStateCache.slideStructure) out[key] = value
      continue
    }
    if (Object.prototype.hasOwnProperty.call(state.stored, key) && state.stored[key] === value) continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * A PASSIVE bot message while quiet. Returns true when it must NOT be sent now (already in the row, or held for the first action); false when it may go as before
 * (the period has ended, or this is not the opened session).
 */
export function openQuietHoldMessage(state: OpenQuiet, sessionId: string, message: unknown, userText?: string): boolean {
  if (!isOpenQuiet(state, sessionId)) return false
  const id = message && typeof message === 'object' ? (message as { message_id?: unknown }).message_id : undefined
  if (typeof id === 'string' && state.storedMessageIds.has(id)) return true
  state.held.push(userText ? { message, userText } : { message })
  if (state.held.length > OPEN_QUIET_HELD_LIMIT) state.held.splice(0, state.held.length - OPEN_QUIET_HELD_LIMIT)
  return true
}

/** Ends the quiet period for good and returns what was held, oldest first (empty when it had already ended). */
export function releaseOpenQuiet(state: OpenQuiet | null | undefined): OpenQuietHeld[] {
  if (!state || state.quiet !== true) return []
  state.quiet = false
  const held = state.held
  state.held = []
  return held
}
