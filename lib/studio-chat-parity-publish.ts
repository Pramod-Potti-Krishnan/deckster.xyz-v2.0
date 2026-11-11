// CHAT-PARITY-C2 (FRONTEND-1): the executors of Director's `publish` studio_action requests (cap `publish1`, flag NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH, default off). They make the SAME requests the Publish dialog's buttons make
// (components/publish-dialog.tsx: POST /api/publish, PATCH /api/publish/{slug}, POST /api/publish/{slug}/rotate, DELETE /api/publish/{slug}, GET /api/publish/by-session/{sessionId}; the link is publishedLink, the copy the dialog's
// handleCopy :844) and nothing the dialog's wizard adds: Director's contract says "use POST /api/publish directly, not the UI wizard" because the wizard can run paid script and audio steps (c2-publish-contract.md :62), so no
// request to /api/narration/* is made here, and a passcode, a restricted visibility, a voice or a viewer-question moderation never arrives (Director answers those itself and sends no frame; the args check refuses them if one did).
// THE CLICK IS DIRECTOR'S: publish_deck, republish_deck, unpublish_deck, rotate_publish_link and configure_publish are sent only after the user's click on Director's own confirm card (mdc_chat_parity_publish._ask :394 /
// handle_card :461, `clicked=True` only for a structured action_value, single use, 300 s); the frame carries no token Studio could check, so THIS EXECUTOR CANNOT PROVE THE CLICK ITSELF. That is why the group's flag ships off and
// stays off until PK rules on it (the PR says so). What Studio does check: the request is for the deck on screen and for the session's own final deck, nothing is read from the frame but typed settings, a first publish never
// overwrites a live record's settings, and a result is `done` only when the server's own answer shows it (never an opened dialog, never a queued request).
// Contract: mdc_chat_parity_publish.py (actions :29-37, args :272-324, lines :508-522), c2-publish-contract.md. The 25 s Director window (RESULT_TTL_SECONDS :47) is held to CHAT_PARITY_PUBLISH_BUDGET_MS by the entry point.

import { chatParityC2Result, type ChatParityC2ErrorCode, type ChatParityPublishArgs, type ChatParityPublishSettings } from '@/lib/studio-chat-parity-c2'
import type { ChatParityResultData } from '@/lib/studio-chat-parity'

export const CHAT_PARITY_PUBLISH_BUDGET_MS = 20_000

/** The slice of the dialog's SerializedPublishedDeck (lib/publish/serialize.ts) the executors read. */
export interface ChatParityPublishRecord {
  slug: string
  sessionId: string
  visibility: string
  allowPdf: boolean
  allowPptx: boolean
  revokedAt: string | null
  republishedAt: string | null
  publishedAt?: string | null
  publicUrl: string
  qaEnabled?: boolean
  qaDailyCap?: number
  qaMonthlyCap?: number
  narrationEnabled?: boolean
  narrationBudgetMinutes?: number | null
  qaReserveMinutes?: number | null
}

export interface ChatParityPublishDeps {
  sessionId: () => string | null
  /** The browser's fetch (same-origin, the signed-in session's cookies). */
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  /** The session's saved row (useChatSessions.loadSession): its final deck id is the one a publish is for. */
  loadSession: (sessionId: string) => Promise<{ finalPresentationId?: string | null } | null>
  /** publishedLink(record): the link the dialog copies and opens. */
  link: (record: ChatParityPublishRecord) => string
  /** The dialog's copy (useCopyToClipboard): true only when the clipboard took it. */
  copy: (text: string) => Promise<boolean>
  /** Opens the link in a NEW tab (never leaves the builder); false when the browser blocked it. */
  open: (url: string) => boolean
  /** What stops a write: a build running or this tab paused for another. */
  gate: () => { building: boolean; paused: boolean }
}

export interface ChatParityPublishOutcome { data: ChatParityResultData; after: null }

const fail = (requestId: string, code: ChatParityC2ErrorCode): ChatParityPublishOutcome => ({ data: chatParityC2Result(requestId, 'failed', code), after: null })
const done = (requestId: string): ChatParityPublishOutcome => ({ data: chatParityC2Result(requestId, 'done'), after: null })

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const toRecord = (value: unknown): ChatParityPublishRecord | null =>
  isRecord(value) && typeof value.slug === 'string' && value.slug && typeof value.sessionId === 'string' && typeof value.visibility === 'string' && typeof value.publicUrl === 'string'
    && typeof value.allowPdf === 'boolean' && typeof value.allowPptx === 'boolean' ? (value as unknown as ChatParityPublishRecord) : null

/** The session's own publish record (GET /api/publish/by-session/{id}): 'none' for a definitive "never published", null when the read did not answer (a failed read is not an answer). */
async function readRecord(deps: ChatParityPublishDeps, sessionId: string): Promise<ChatParityPublishRecord | 'none' | null> {
  try {
    const response = await deps.fetch(`/api/publish/by-session/${encodeURIComponent(sessionId)}`)
    if (!response.ok) return null
    const body: unknown = await response.json().catch(() => null)
    if (!isRecord(body) || !('deck' in body)) return null
    if (body.deck === null) return 'none'
    return toRecord(body.deck)
  } catch { return null }
}

async function send(deps: ChatParityPublishDeps, path: string, init: RequestInit): Promise<{ ok: boolean; status: number; deck: ChatParityPublishRecord | null }> {
  try {
    const response = await deps.fetch(path, init)
    const body: unknown = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, deck: isRecord(body) ? toRecord(body.deck) : null }
  } catch { return { ok: false, status: 0, deck: null } }
}

/** True when `key` of the settings is what the server's answer now shows. */
function settingsApplied(deck: ChatParityPublishRecord, settings: ChatParityPublishSettings): boolean {
  return (Object.keys(settings) as (keyof ChatParityPublishSettings)[]).every(key => (deck as unknown as Record<string, unknown>)[key] === settings[key])
}

export async function runChatParityPublishAction(requestId: string, presentationId: string | null, args: ChatParityPublishArgs, deps: ChatParityPublishDeps): Promise<ChatParityPublishOutcome> {
  const sessionId = deps.sessionId()
  if (!sessionId || !presentationId) return fail(requestId, 'no_deck')
  const read = args.action === 'open_publish_link' || args.action === 'copy_publish_link'
  if (!read) { const state = deps.gate(); if (state.building || state.paused) return fail(requestId, 'locked') }
  const before = await readRecord(deps, sessionId)
  if (before === null) return fail(requestId, 'write_failed')

  if (read) {
    // Reads of the live link: the record must be live and the session's own; the link is never sent back to Director.
    if (before === 'none' || before.revokedAt) return fail(requestId, 'not_published')
    if (before.sessionId !== sessionId) return fail(requestId, 'state_changed')
    const link = deps.link(before)
    if (!/^https?:\/\//i.test(link)) return fail(requestId, 'write_failed')
    if (args.action === 'copy_publish_link') return (await deps.copy(link).catch(() => false)) ? done(requestId) : fail(requestId, 'browser_blocked')
    return deps.open(link) ? done(requestId) : fail(requestId, 'browser_blocked')
  }

  // A write is for the session's own final deck, the one on screen (Director's directive names it: presentation_id).
  const row = await deps.loadSession(sessionId).catch(() => null)
  if (!row) return fail(requestId, 'write_failed')
  if (!row.finalPresentationId) return fail(requestId, 'no_deck')
  if (row.finalPresentationId !== presentationId) return fail(requestId, 'state_changed')

  switch (args.action) {
    case 'publish_deck': {
      // A first publish only. POST /api/publish on a live record applies the settings it carries (the dialog's own comments warn: it would turn a restricted deck unlisted and switch downloads back on), so a live record is never touched.
      if (before !== 'none' && !before.revokedAt) return fail(requestId, 'state_changed')
      const sent = await send(deps, '/api/publish', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ sessionId, visibility: args.visibility, allowPdf: args.allowPdf, allowPptx: args.allowPptx }) })
      if (sent.status === 409) return fail(requestId, 'no_deck')
      if (!sent.ok || !sent.deck) return fail(requestId, 'snapshot_failed')
      const deck = sent.deck
      return deck.sessionId === sessionId && !deck.revokedAt && deck.visibility === args.visibility && deck.allowPdf === args.allowPdf && deck.allowPptx === args.allowPptx ? done(requestId) : fail(requestId, 'state_changed')
    }
    case 'republish_deck': {
      if (before === 'none' || before.revokedAt) return fail(requestId, 'not_published')
      // No settings are sent: the link and the sharing settings stay as they are (c2-publish-contract.md :58).
      const sent = await send(deps, '/api/publish', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ sessionId }) })
      if (sent.status === 409) return fail(requestId, 'no_deck')
      if (!sent.ok || !sent.deck) return fail(requestId, 'snapshot_failed')
      const deck = sent.deck
      const kept = deck.slug === before.slug && deck.sessionId === sessionId && !deck.revokedAt
        && deck.visibility === before.visibility && deck.allowPdf === before.allowPdf && deck.allowPptx === before.allowPptx
      return kept && Boolean(deck.republishedAt) && deck.republishedAt !== before.republishedAt ? done(requestId) : fail(requestId, 'state_changed')
    }
    case 'unpublish_deck': {
      if (before === 'none' || before.revokedAt) return fail(requestId, 'not_published')
      const sent = await send(deps, `/api/publish/${encodeURIComponent(before.slug)}`, { method: 'DELETE' })
      if (!sent.ok || !sent.deck) return fail(requestId, 'write_failed')
      return sent.deck.slug === before.slug && Boolean(sent.deck.revokedAt) ? done(requestId) : fail(requestId, 'state_changed')
    }
    case 'rotate_publish_link': {
      if (before === 'none' || before.revokedAt) return fail(requestId, 'not_published')
      const sent = await send(deps, `/api/publish/${encodeURIComponent(before.slug)}/rotate`, { method: 'POST' })
      if (!sent.ok || !sent.deck) return fail(requestId, 'snapshot_failed')
      return sent.deck.sessionId === sessionId && !sent.deck.revokedAt && sent.deck.slug !== before.slug ? done(requestId) : fail(requestId, 'state_changed')
    }
    case 'configure_publish': {
      if (before === 'none' || before.revokedAt) return fail(requestId, 'not_published')
      const sent = await send(deps, `/api/publish/${encodeURIComponent(before.slug)}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(args.settings) })
      if (!sent.ok || !sent.deck) return fail(requestId, 'write_failed')
      return sent.deck.slug === before.slug && !sent.deck.revokedAt && settingsApplied(sent.deck, args.settings) ? done(requestId) : fail(requestId, 'write_failed')
    }
    default: return fail(requestId, 'unsupported')
  }
}
