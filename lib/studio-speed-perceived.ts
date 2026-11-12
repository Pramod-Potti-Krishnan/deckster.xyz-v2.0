// FRONTEND-2 (SPEED + ROUTER ACCELERATION, 25 Oct; streams/frontend/pass3/speed/STUDIO-WAITS.md row 1-2): the user's typed message shows in the chat at
// once, as a quiet "Sending…" echo, instead of only after Studio has created the history row, checked the blank canvas with Layout and put the bytes on the
// socket (app/builder/page.tsx handleSendMessage: "deliver first, commit after"). The base still decides everything: it commits the real bubble exactly as
// before, and the echo leaves in the same render. Nothing here sends, persists or commits a message.
// Flag NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED (exact "true", default off, build-time). Off: the page passes no echo to the chat and wraps nothing, so the chat
// and the composer get exactly the base's props.
//
// Life of one echo (pure functions below; hooks/use-studio-speed-perceived-echo.ts holds the state and the timers):
//   begin    the composer's submit starts it: the draft text, its attached files, the ids of the user turns already in the chat, the session it belongs to.
//   reveal   SPEED_ECHO_REVEAL_MS later it may be drawn. A send that settles sooner (a guard that refused it, an open socket that delivered it) never shows one,
//            so the fast paths look exactly like the base (no flash of a pending bubble before the real one).
//   commit   the base adds a NEW user turn with the same text: the echo is gone in that render (derived, not timed).
//   settle   the submit handler finished. Not committed and not superseded: the message was not sent (the base's toast says why and keeps the draft), so the
//            echo turns into a visible "Not sent" line until the draft changes, a new submit starts, or SPEED_ECHO_FAILED_MS pass. When the base opened its
//            manual-deck choice instead (the user still has to pick), the echo just leaves.
//   scope    a different session (switch, new chat) drops it at once.
// At rest (committed, cleared or dropped) the chat is the base's, so the end state is the same with the flag off and on.
import type { UserChatMessage, UserMessageAttachment } from '@/lib/user-message-attachments'

export const STUDIO_SPEED_PERCEIVED_FLAG = 'NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED'
export const STUDIO_SPEED_PERCEIVED_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED === 'true'

/** A send that settles within this many ms never draws an echo (under the ~100 ms people read as instant). */
export const SPEED_ECHO_REVEAL_MS = 80
/** How long a "Not sent" echo stays when nothing else clears it (the base's toast says the same thing). */
export const SPEED_ECHO_FAILED_MS = 6000

export const SPEED_ECHO_PENDING_LABEL = 'Sending…'
export const SPEED_ECHO_FAILED_LABEL = 'Not sent. Your message is still in the box.'

export interface SpeedEchoState {
  readonly token: number
  readonly text: string
  readonly attachments: readonly UserMessageAttachment[]
  /** Ids of the user turns already in the chat when the echo began: only a turn that is NOT one of them can be its commit. */
  readonly knownIds: readonly string[]
  readonly scopeKey: string | null
  readonly revealed: boolean
  readonly settled: boolean
}

export interface SpeedEchoView {
  readonly key: string
  readonly text: string
  readonly attachments: readonly UserMessageAttachment[]
  readonly status: 'pending' | 'failed'
}

export interface SpeedEchoContext {
  readonly userMessages: readonly UserChatMessage[]
  readonly scopeKey: string | null
  /** The composer's current text (a "Not sent" echo stays only while the draft is still the message). */
  readonly inputMessage: string
  /** The base's manual-deck choice is open: the send is waiting on the user, not failed. */
  readonly choiceOpen: boolean
}

/** The draft text the page will send for a plain composer submit (handleSendMessage: `(messageOverride ?? inputMessage).trim()`, no override). */
export function speedEchoText(inputMessage: unknown): string {
  return typeof inputMessage === 'string' ? inputMessage.trim() : ''
}

export function speedEchoBegin(input: {
  token: number
  text: string
  attachments?: readonly UserMessageAttachment[] | null
  userMessages: readonly UserChatMessage[]
  scopeKey: string | null
}): SpeedEchoState | null {
  if (!input.text) return null
  return {
    token: input.token,
    text: input.text,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    knownIds: input.userMessages.map(message => message.id),
    scopeKey: input.scopeKey,
    revealed: false,
    settled: false,
  }
}

/** Only a send still in flight is revealed: one that settled inside the window stays undrawn (a refused or delivered send shows no echo). */
export function speedEchoReveal(echo: SpeedEchoState | null, token: number): SpeedEchoState | null {
  return echo && echo.token === token && !echo.revealed && !echo.settled ? { ...echo, revealed: true } : echo
}

/** A second submit of the same draft while the first is still in flight (the base drops it as a duplicate) keeps the first echo. */
export function speedEchoInFlight(echo: SpeedEchoState | null, text: string, scopeKey: string | null): boolean {
  return Boolean(echo && !echo.settled && echo.text === text && echo.scopeKey === scopeKey)
}

export function speedEchoSettle(echo: SpeedEchoState | null, token: number): SpeedEchoState | null {
  return echo && echo.token === token && !echo.settled ? { ...echo, settled: true } : echo
}

/** The base committed this echo's message: a user turn that was not in the chat when it began, with the same text. */
export function speedEchoCommitted(echo: SpeedEchoState, userMessages: readonly UserChatMessage[]): boolean {
  const known = new Set(echo.knownIds)
  return userMessages.some(message => !known.has(message.id) && message.text === echo.text)
}

/** Whether the echo is done for good (the hook drops it): committed, another session, or a settle that will never be drawn. */
export function speedEchoFinished(echo: SpeedEchoState | null, context: SpeedEchoContext): boolean {
  if (!echo) return false
  if (echo.scopeKey !== context.scopeKey) return true
  if (speedEchoCommitted(echo, context.userMessages)) return true
  if (!echo.settled) return false
  if (!echo.revealed || context.choiceOpen) return true
  return speedEchoText(context.inputMessage) !== echo.text
}

/** What the chat draws for the echo now, or null (nothing: the chat is the base's). */
export function speedEchoView(echo: SpeedEchoState | null, context: SpeedEchoContext): SpeedEchoView | null {
  if (!echo || !echo.revealed || speedEchoFinished(echo, context)) return null
  return {
    key: `speed-echo-${echo.token}`,
    text: echo.text,
    attachments: echo.attachments,
    status: echo.settled ? 'failed' : 'pending',
  }
}
