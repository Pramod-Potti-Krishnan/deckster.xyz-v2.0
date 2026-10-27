/**
 * CHAT-PARITY (FRONTEND-1): the executors of Director's `studio_action` requests, one per action, each calling the SAME function the
 * click path calls (the page hands those in as `deps`). lib/studio-chat-parity.ts (import-free) decides what a request is and what an
 * answer looks like; this file does the running: the owner check, the group's executor, its timeout, and a known status on every exit.
 * Contract: deckster-workspace streams/frontend1/chat-parity-p3/CONTRACTS.md; DIRECTOR-2's GO of 27 Oct 03:59Z (timeouts: 25 s default,
 * a theme apply THEME_SYNC_TIMEOUT_MS + 5 s, a logo generation 60 s; Studio answers even on failure).
 *
 * The executor table starts empty: each row group's commit adds its actions here and to CHAT_PARITY_ACTIONS.
 */

import {
  CHAT_PARITY_ACTIONS, chatParityResult, type ChatParityErrorCode, type ChatParityRequest, type ChatParityResultData,
} from '@/lib/studio-chat-parity'
import { runChatParityThemeAction, type ChatParityThemeDeps } from '@/lib/studio-chat-parity-themes'
import { runChatParityIdentityAction, type ChatParityIdentityDeps } from '@/lib/studio-chat-parity-identity'

/** Who delivered the request: the socket's session, and whether that socket is still the live one (the answer goes back on it). */
export type ChatParityOwner = import('@/lib/studio-chat-parity').ChatParityOwner

/** The session and presentation on screen now (the page's K5 owner record, elementDirectiveGenerationOwnerRef). */
export interface ChatParityDisplayedDeck {
  sessionId?: string | null
  deckOwnerSessionId?: string | null
  presentationId?: string | null
  epoch?: number
}

/** What the page hands every executor. Each group's commit adds the click path's functions it needs. */
export interface ChatParityDeps {
  displayed: () => ChatParityDisplayedDeck
  /** THEMES (rows 56-59, 61): present only with NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES on. */
  themes?: ChatParityThemeDeps
  /** IDENTITY (rows 62-64): present only with NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY on. */
  identity?: ChatParityIdentityDeps
}

export type ChatParityExecutor = (request: ChatParityRequest, owner: ChatParityOwner, deps: ChatParityDeps, check: ChatParityOwnerCheck) => Promise<ChatParityResultData>

/** Default wait for an answer; per-action waits below (DIRECTOR-2, 27 Oct: a logo generation 60 s). */
export const CHAT_PARITY_DEFAULT_TIMEOUT_MS = 25_000
export const CHAT_PARITY_TIMEOUTS_MS: Record<string, number> = { generate_logo: 60_000 }

const themeExecutor: ChatParityExecutor = (request, _owner, deps, check) =>
  deps.themes ? runChatParityThemeAction(request, check.presentationId, check.owns, deps.themes) : Promise.resolve(chatParityResult(request.requestId, 'failed', 'flag_off'))

const identityExecutor: ChatParityExecutor = (request, _owner, deps, check) =>
  deps.identity ? runChatParityIdentityAction(request, check.presentationId, deps.identity) : Promise.resolve(chatParityResult(request.requestId, 'failed', 'flag_off'))

/** The executors, by action (each group's commit adds its own); an action with no executor answers `unsupported`. */
export const CHAT_PARITY_EXECUTORS: Record<string, ChatParityExecutor> = {
  ...Object.fromEntries(CHAT_PARITY_ACTIONS.themes.map(action => [action, themeExecutor])),
  ...Object.fromEntries(CHAT_PARITY_ACTIONS.identity.map(action => [action, identityExecutor])),
}

export interface ChatParityOwnerCheck {
  /** The request belongs to the delivering session and names the deck on screen (or names no deck). */
  ok: boolean
  /** Still the same session, deck and epoch on screen (for a long run). */
  owns: () => boolean
  presentationId: string | null
}

/** The owner check of the K5 add, refine and theme runners: the request belongs to the session and the presentation on screen, and stays so. */
export function chatParityOwnerCheck(request: ChatParityRequest, message: { session_id?: string } | null, owner: ChatParityOwner, displayed: () => ChatParityDisplayedDeck): ChatParityOwnerCheck {
  const start = displayed()
  const owns = () => {
    const now = displayed()
    return Boolean(start.sessionId && now.sessionId === start.sessionId && now.deckOwnerSessionId === start.deckOwnerSessionId
      && now.presentationId === start.presentationId && now.epoch === start.epoch)
  }
  const sessionOk = Boolean(owner.sessionId && start.sessionId === owner.sessionId && (typeof message?.session_id !== 'string' || message.session_id === owner.sessionId))
  const deckOk = request.presentationId === null || (Boolean(start.presentationId) && request.presentationId === start.presentationId && start.deckOwnerSessionId === start.sessionId)
  return { ok: sessionOk && owns() && deckOk, owns, presentationId: start.presentationId ?? null }
}

function withTimeout<T>(run: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false
    const timer = setTimeout(() => { if (!done) { done = true; resolve(onTimeout()) } }, ms)
    run.then(value => { if (!done) { done = true; clearTimeout(timer); resolve(value) } }, error => { if (!done) { done = true; clearTimeout(timer); reject(error) } })
  })
}

/**
 * Runs one request to a known status: `unsupported` for an action with no executor, `not_owner` when the request is not for the deck on
 * screen, `timeout` when the executor outlives its wait, `write_failed` when it throws. Never rejects.
 */
export async function runChatParityAction(request: ChatParityRequest, owner: ChatParityOwner, deps: ChatParityDeps, message: { session_id?: string } | null = null): Promise<ChatParityResultData> {
  const fail = (code: ChatParityErrorCode) => chatParityResult(request.requestId, 'failed', code)
  const run = CHAT_PARITY_ACTIONS[request.group]?.includes(request.action) ? CHAT_PARITY_EXECUTORS[request.action] : undefined
  if (!run) return fail('unsupported')
  const check = chatParityOwnerCheck(request, message, owner, deps.displayed)
  if (!check.ok) return fail('not_owner')
  try {
    return await withTimeout(run(request, owner, deps, check), CHAT_PARITY_TIMEOUTS_MS[request.action] ?? CHAT_PARITY_DEFAULT_TIMEOUT_MS, () => fail('timeout'))
  } catch {
    return fail('write_failed')
  }
}
